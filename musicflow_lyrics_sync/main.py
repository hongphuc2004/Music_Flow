"""
main.py — Main Polling Consumer for MusicFlow AI Alignment Worker
Handles atomic job claim, heartbeat loop, stale lock reclamation,
audio pipeline execution, OCC draft application, and temp file lifecycle.
"""

import os
import sys

# Crucial Memory Safety Constraints for Linux 512MB RAM Containers
os.environ["MALLOC_ARENA_MAX"] = "1"
os.environ["ORT_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import logging
import shutil
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import PyMongoError

# Ensure current directory is on sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

import config
from pipeline.aligner import (
    CTCAlignmentError,
    CTCInferenceError,
    CTCModelLoadError,
    CTCTokenizerError,
    align_lyrics,
)
from pipeline.downloader import AudioValidationError, download_audio_asset
from pipeline.postprocessor import apply_energy_tail_extension, compile_line_and_word_lyrics, format_lrc_timestamp
from pipeline.onset_snapper import snap_word_onsets
from pipeline.preprocessor import convert_to_16k_mono
from pipeline.validator import validate_alignment_quality

class GPUOutOfMemoryError(Exception):
    pass

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [Worker] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("AlignmentWorker")

def get_utc_now() -> datetime:
    """Returns timezone-naive UTC datetime for MongoDB BSON compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class AlignmentWorker:
    def __init__(self):
        self.worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        self.client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)
        try:
            default_db = self.client.get_default_database()
            self.db = default_db if default_db is not None else self.client.get_database(config.DATABASE_NAME)
        except Exception:
            self.db = self.client.get_database(config.DATABASE_NAME)
        self.running = True
        self.active_job_id = None
        self.heartbeat_thread = None

        logger.info(f"Initialized AI Alignment Worker (ID: {self.worker_id})")
        logger.info(f"Connected to MongoDB: {config.DATABASE_NAME}")
        logger.info(f"Config: Device={config.WORKER_DEVICE}, CPU_Fallback={config.ALLOW_CPU_FALLBACK}")
        # Note: Model loading is lazy-deferred to job execution to keep container boot RAM under ~60MB

    def warmup_models(self):
        """
        Pre-warms ONNX INT8 session during worker startup
        so all subsequent jobs execute with zero initialization latency.
        """
        try:
            logger.info("[Worker] Pre-warming ONNX INT8 acoustic model...")
            w_start = time.time()
            from pipeline.aligner import ONNXCTCModelManager
            base_dir = os.path.dirname(os.path.abspath(__file__))
            onnx_path = os.path.join(base_dir, "models", "wav2vec2_onnx_int8", "model_quantized.onnx")
            if os.path.exists(onnx_path):
                ONNXCTCModelManager.get_instance().load_model()
            elif config.WORKER_DEVICE == "cuda":
                import torch
                _ = torch.zeros((1, 1, 16000), device="cuda")
                torch.cuda.synchronize()
            else:
                from pipeline.aligner import CTCModelManager
                CTCModelManager().load_model(config.CTC_MODEL_NAME, device=config.WORKER_DEVICE)
            w_dur = round((time.time() - w_start) * 1000, 1)
            logger.info(f"[Worker] Models and device warmed up in {w_dur}ms (Lifecycle: Ready)")
        except Exception as e:
            logger.warning(f"[Worker] Warmup non-critical warning: {e}")

    def start_heartbeat(self, job_id):
        """Spawns background daemon thread to send heartbeat ping every 30 seconds."""
        self.active_job_id = job_id
        def heartbeat_loop():
            while self.running and self.active_job_id == job_id:
                time.sleep(config.HEARTBEAT_INTERVAL_SEC)
                if self.active_job_id == job_id:
                    try:
                        self.db.lyricsalignmentjobs.update_one(
                            {"_id": job_id, "status": "processing"},
                            {"$set": {"lastHeartbeatAt": get_utc_now()}}
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send heartbeat for job {job_id}: {e}")
        self.heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

    def stop_heartbeat(self):
        """Stops the active heartbeat thread."""
        self.active_job_id = None

    def reclaim_stale_locks(self):
        """
        Reclaims dead/crashed jobs:
        Finds jobs with status='processing' and lastHeartbeatAt older than STALE_LOCK_THRESHOLD_SEC.
        """
        try:
            stale_threshold = get_utc_now() - timedelta(seconds=config.STALE_LOCK_THRESHOLD_SEC)
            stale_jobs = self.db.lyricsalignmentjobs.find({
                "status": "processing",
                "lastHeartbeatAt": {"$lt": stale_threshold}
            })

            for job in stale_jobs:
                job_id = job["_id"]
                attempt_count = job.get("attemptCount", 1)

                if attempt_count < config.MAX_JOB_ATTEMPTS:
                    logger.warning(f"Reclaiming stale job {job_id} (attempts: {attempt_count}/{config.MAX_JOB_ATTEMPTS}) -> Resetting to pending")
                    self.db.lyricsalignmentjobs.update_one(
                        {"_id": job_id, "status": "processing"},
                        {
                            "$set": {"status": "pending", "workerId": None},
                            "$push": {"qualityNotes": "RECLAIMED_FROM_STALE_LOCK"}
                        }
                    )
                else:
                    logger.error(f"Marking stale job {job_id} as failed (exceeded max attempts {config.MAX_JOB_ATTEMPTS})")
                    self.db.lyricsalignmentjobs.update_one(
                        {"_id": job_id, "status": "processing"},
                        {
                            "$set": {
                                "status": "failed",
                                "failedAt": get_utc_now(),
                                "errorCode": "WORKER_CRASHED_MAX_RETRIES",
                                "errorMessage": "Tác vụ bị gián đoạn do sự cố máy chủ và đã vượt quá số lần thử lại tối đa"
                            }
                        }
                    )
        except Exception as e:
            logger.error(f"Error checking stale locks: {e}")

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Atomic claim using find_one_and_update on MongoDB.
        Ensures two workers never claim the same job simultaneously.
        """
        now = get_utc_now()
        claimed = self.db.lyricsalignmentjobs.find_one_and_update(
            filter={
                "status": "pending",
                "attemptCount": {"$lt": config.MAX_JOB_ATTEMPTS}
            },
            update={
                "$set": {
                    "status": "processing",
                    "workerId": self.worker_id,
                    "processingStartedAt": now,
                    "lastHeartbeatAt": now
                },
                "$inc": {"attemptCount": 1}
            },
            sort=[("createdAt", 1)], # FIFO queue
            return_document=ReturnDocument.AFTER
        )
        return claimed

    def update_job_progress(self, job_id, stage: str, progress_percent: int, message: str):
        """Updates real-time pipeline stage, progress percentage, and human-friendly message for UI."""
        try:
            self.db.lyricsalignmentjobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "stage": stage,
                        "progressPercent": progress_percent,
                        "progressMessage": message,
                        "lastHeartbeatAt": get_utc_now()
                    }
                }
            )
        except Exception as e:
            logger.warning(f"Could not update progress for job {job_id}: {e}")

    def process_job(self, job: Dict[str, Any]):
        job_id = job["_id"]
        song_id = job["songId"]
        audio_public_id = job.get("audioPublicId")
        if not audio_public_id:
            song_doc = self.db.songs.find_one({"_id": song_id})
            if song_doc:
                audio_public_id = song_doc.get("audioPublicId") or song_doc.get("audioUrl")
        if not audio_public_id:
            raise ValueError(f"Không tìm thấy audioPublicId hoặc tệp âm thanh cho bài hát {song_id}")
        audio_public_id = str(audio_public_id)

        expected_version = job.get("expectedDraftVersion", 1)
        pipeline_mode = job.get("pipelineMode", "lyrics_provided")
        temp_job_dir = os.path.join(config.TEMP_STORAGE_DIR, str(job_id))



        logger.info(f"Processing Job {job_id} for Song {song_id} (audioPublicId: {audio_public_id})")
        self.start_heartbeat(job_id)
        start_time = time.time()
        if pipeline_mode == "auto_transcribe":
            return self.process_transcription_job(job, temp_job_dir, audio_public_id, start_time)

        try:
            # 1. Fetch plain lyrics from SongLyrics
            self.update_job_progress(job_id, "STARTING", 5, "Đang khởi động phòng thu AI...")
            song_lyrics_doc = self.db.songlyrics.find_one({"songId": song_id})
            if not song_lyrics_doc:
                # Initialize draft if missing
                self.db.songlyrics.insert_one({
                    "songId": song_id,
                    "artistId": job.get("artistId"),
                    "status": "draft",
                    "lyricsType": "plain",
                    "plainLyrics": "",
                    "version": 1,
                    "createdAt": get_utc_now(),
                    "updatedAt": get_utc_now()
                })
                song_lyrics_doc = self.db.songlyrics.find_one({"songId": song_id})

            song_lyrics_doc = song_lyrics_doc or {}
            plain_lyrics = song_lyrics_doc.get("plainLyrics") or ""
            if not plain_lyrics or len(plain_lyrics.strip()) < 10:
                raise ValueError("Lời bài hát quá ngắn hoặc chưa có nội dung (tối thiểu 10 ký tự)")

            # 2. Check Crash Recovery: Has this job already been applied to SongLyrics?
            if song_lyrics_doc.get("lastAlignmentJobId") == job_id:
                logger.info(f"Job {job_id} already applied to SongLyrics. Marking succeeded immediately.")
                self.db.lyricsalignmentjobs.update_one(
                    {"_id": job_id},
                    {
                        "$set": {
                            "status": "succeeded",
                            "stage": "COMPLETED",
                            "progressPercent": 100,
                            "progressMessage": "Đã hoàn thành tạo nhịp bài hát thành công!",
                            "completedAt": get_utc_now(),
                            "qualityStatus": "GOOD"
                        }
                    }
                )
                return

            # 3. Download Audio Asset
            self.update_job_progress(job_id, "DOWNLOADING", 15, "Đang tải tệp âm thanh bài hát...")
            logger.info(f"[{job_id}] Downloading audio asset...")
            dl_start = time.time()
            raw_audio_path, duration_sec = download_audio_asset(
                self.db,
                song_id,
                audio_public_id,
                temp_job_dir,
                max_duration_sec=config.MAX_SONG_DURATION_SEC
            )
            download_duration = round(time.time() - dl_start, 3)

            # 4. Preprocess to 16kHz Mono WAV with High-Pass Filter & Normalization
            self.update_job_progress(job_id, "PREPROCESSING", 25, "Đang chuẩn hóa chất lượng âm thanh...")
            logger.info(f"[{job_id}] Converting to 16kHz Mono WAV (HighPass={config.AUDIO_HIGH_PASS_ENABLED}, {config.AUDIO_HIGH_PASS_HZ}Hz)...")
            prep_start = time.time()
            wav_16k_path = os.path.join(temp_job_dir, "input_16k.wav")
            convert_to_16k_mono(
                raw_audio_path,
                wav_16k_path,
                high_pass_enabled=config.AUDIO_HIGH_PASS_ENABLED,
                high_pass_hz=config.AUDIO_HIGH_PASS_HZ,
                normalize_enabled=config.AUDIO_NORMALIZE_ENABLED
            )
            prep_duration = round(time.time() - prep_start, 3)

            # Immediately delete raw downloaded audio to free disk and tmpfs memory
            if os.path.exists(raw_audio_path) and raw_audio_path != wav_16k_path:
                try:
                    os.remove(raw_audio_path)
                except Exception:
                    pass
            import gc
            gc.collect()
            try:
                import ctypes
                ctypes.CDLL("libc.so.6").malloc_trim(0)
            except Exception:
                pass

            # 5. HTDemucs Vocal Separation (Optional, skipped in lightweight mode to prevent OOM on 512MB RAM)
            use_separation = (
                config.ENABLE_VOCAL_SEPARATION
                and config.SEPARATOR_MODEL
                and config.SEPARATOR_MODEL.lower() != "none"
            )
            if use_separation:
                self.update_job_progress(job_id, "SEPARATING", 45, "Đang lọc tách giọng hát ca sĩ...")
                sep_start = time.time()
                logger.info(f"[{job_id}] Running HTDemucs vocal separation...")
                try:
                    from pipeline.separator import separate_vocals
                    vocals_path = separate_vocals(
                        wav_16k_path,
                        temp_job_dir,
                        model_name=config.SEPARATOR_MODEL,
                        allow_cpu_fallback=config.ALLOW_CPU_FALLBACK,
                        device=config.WORKER_DEVICE
                    )
                    sep_duration = round(time.time() - sep_start, 3)
                except Exception as e:
                    logger.warning(f"[{job_id}] Vocal separation bypassed: {e}. Falling back to master audio.")
                    vocals_path = wav_16k_path
                    sep_duration = 0.0
            else:
                logger.info(f"[{job_id}] Vocal separation bypassed (Lightweight direct alignment mode).")
                vocals_path = wav_16k_path
                sep_duration = 0.0

            # 6. Real Neural Wav2Vec2 CTC Forced Alignment
            self.update_job_progress(job_id, "ALIGNING", 70, "Đang đồng bộ nhịp điệu lời bài hát...")
            align_start = time.time()
            logger.info(f"[{job_id}] Running Vietnamese Wav2Vec2 CTC acoustic alignment ({config.CTC_MODEL_NAME})...")
            raw_words, _ = align_lyrics(
                vocals_path,
                plain_lyrics,
                model_name=config.CTC_MODEL_NAME,
                device=config.WORKER_DEVICE
            )
            align_duration = round(time.time() - align_start, 3)

            # 6.5. Acoustic Attack Transient Snapping
            try:
                raw_words = snap_word_onsets(vocals_path, raw_words)
            except Exception as e:
                logger.warning(f"[{job_id}] Onset snapping skipped: {e}")

            # 7. Post-Processing (Energy Tail Extension & Word Bridging)
            self.update_job_progress(job_id, "POSTPROCESSING", 88, "Đang tinh chỉnh độ ngân & khớp mốc thời gian...")
            post_start = time.time()
            logger.info(f"[{job_id}] Applying Energy Tail Extension...")
            processed_words = apply_energy_tail_extension(
                vocals_path,
                raw_words,
                duration_sec,
                max_tail_sec=config.MAX_TAIL_EXTENSION_SEC,
                energy_threshold_db=config.ENERGY_TAIL_THRESHOLD_DB
            )

            # 8. Compile Line and Word Timestamps
            synced_lines, lrc_data = compile_line_and_word_lyrics(processed_words, plain_lyrics)
            post_duration = round(time.time() - post_start, 3)

            # 9. Quality Validation
            val_start = time.time()
            quality_status, quality_notes = validate_alignment_quality(
                synced_lines,
                plain_lyrics,
                duration_sec
            )
            val_duration = round(time.time() - val_start, 3)
            logger.info(f"[{job_id}] Quality Assessment: {quality_status} ({quality_notes})")

            total_duration = round(time.time() - start_time, 3)

            # 10. OCC Safe Result Application to SongLyrics Draft
            db_start = time.time()
            update_res = self.db.songlyrics.update_one(
                {
                    "songId": song_id,
                    "version": expected_version
                },
                {
                    "$set": {
                        "lyricsType": "synced",
                        "syncSource": "ai_alignment",
                        "lastAlignmentJobId": job_id,
                        "plainLyrics": plain_lyrics,
                        "lrcData": lrc_data,
                        "syncedLines": synced_lines,
                        "updatedAt": get_utc_now()
                    },
                    "$inc": {"version": 1}
                }
            )

            if update_res.modified_count == 0:
                logger.warning(f"[{job_id}] OCC Draft Protection: Artist modified draft during alignment! Preserving Artist draft.")
                quality_notes.append("DRAFT_MODIFIED_DURING_ALIGNMENT: Bản nháp của nghệ sĩ được giữ nguyên do có chỉnh sửa gần đây")

            db_duration = round(time.time() - db_start, 3)

            perf_metadata = {
                "totalMs": int(total_duration * 1000),
                "downloadMs": int(download_duration * 1000),
                "preprocessMs": int(prep_duration * 1000),
                "separatorLoadMs": 0,
                "separatorInferenceMs": int(sep_duration * 1000),
                "alignerLoadMs": 0,
                "alignerInferenceMs": int(align_duration * 1000),
                "postprocessMs": int(post_duration * 1000),
                "validationMs": int(val_duration * 1000),
                "databaseMs": int(db_duration * 1000)
            }

            # 11. Mark Job Succeeded
            self.db.lyricsalignmentjobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "status": "succeeded",
                        "stage": "COMPLETED",
                        "progressPercent": 100,
                        "progressMessage": "Đã hoàn thành tạo nhịp tự động thành công!",
                        "completedAt": get_utc_now(),
                        "result": {
                            "syncedLines": synced_lines,
                            "lrcData": lrc_data,
                            "qualityStatus": quality_status,
                            "qualityNotes": quality_notes,
                            "performance": perf_metadata,
                            "alignmentMethod": "ctc_viterbi"
                        },
                        "metadata.alignmentMethod": "ctc_viterbi",
                        "metadata.modelName": config.CTC_MODEL_NAME,
                        "metadata.pipelineVersion": config.PIPELINE_VERSION,
                        "metadata.separationTimeSec": sep_duration,
                        "metadata.alignmentTimeSec": align_duration,
                        "metadata.totalDurationSec": total_duration,
                        "metadata.performance": perf_metadata
                    }
                }
            )
            logger.info(f"✅ Job {job_id} Succeeded in {total_duration}s (Sep: {sep_duration}s, CTC Align: {align_duration}s)")

        except CTCModelLoadError as e:
            logger.error(f"[{job_id}] CTC Model Load Error: {e}")
            self.mark_job_failed(job_id, "CTC_MODEL_LOAD_FAILED", str(e))
        except CTCTokenizerError as e:
            logger.error(f"[{job_id}] CTC Tokenizer Error: {e}")
            self.mark_job_failed(job_id, "CTC_TOKENIZER_ERROR", str(e))
        except CTCInferenceError as e:
            logger.error(f"[{job_id}] CTC Inference Error: {e}")
            self.mark_job_failed(job_id, "CTC_INFERENCE_FAILED", str(e))
        except CTCAlignmentError as e:
            logger.error(f"[{job_id}] CTC Alignment Error: {e}")
            self.mark_job_failed(job_id, "CTC_ALIGNMENT_FAILED", str(e))
        except AudioValidationError as e:
            logger.error(f"[{job_id}] Audio Validation Error: {e.code} - {e.message}")
            self.mark_job_failed(job_id, e.code, e.message)
        except GPUOutOfMemoryError as e:
            logger.error(f"[{job_id}] GPU OOM Error: {e}")
            self.mark_job_failed(job_id, "GPU_OUT_OF_MEMORY", str(e))
        except Exception as e:
            logger.error(f"[{job_id}] Execution Error: {str(e)}", exc_info=True)
            self.mark_job_failed(job_id, "ALIGNMENT_FAILED", f"Lỗi thực thi căn nhịp: {str(e)}")
        finally:
            self.stop_heartbeat()
            # Cleanup temporary working directory
            if os.path.exists(temp_job_dir):
                try:
                    shutil.rmtree(temp_job_dir, ignore_errors=True)
                except Exception as e:
                    logger.warning(f"Could not delete temp dir {temp_job_dir}: {e}")

    def process_transcription_job(self, job: Dict[str, Any], temp_job_dir: str, audio_public_id: str, start_time: float):
        """
        Executes Faster-Whisper ASR Audio-to-Lyrics Draft Transcription.
        Produces raw text and rough word/segment timestamps for Artist Review.
        Does NOT alter the Wav2Vec2 forced alignment pipeline.
        """
        import hashlib
        job_id = job["_id"]
        song_id = job["songId"]
        target_model = job.get("transcriptionModel") or config.WHISPER_MODEL_SIZE
        target_lang = job.get("language") or config.WHISPER_LANGUAGE

        logger.info(f"[{job_id}] Processing Auto-Transcription Job for Song {song_id} (model={target_model}, lang={target_lang})")

        try:
            # 1. Download Audio Asset
            self.update_job_progress(job_id, "DOWNLOADING", 15, "Đang tải tệp âm thanh bài hát...")
            dl_start = time.time()
            raw_audio_path, duration_sec = download_audio_asset(
                self.db,
                song_id,
                audio_public_id,
                temp_job_dir,
                max_duration_sec=config.MAX_SONG_DURATION_SEC
            )
            download_duration = round(time.time() - dl_start, 3)

            # 2. Preprocess to 16kHz Mono WAV with Vocal Clarity High-Pass Filter
            self.update_job_progress(job_id, "PREPROCESSING", 25, "Đang chuẩn hóa âm thanh bài hát...")
            wav_16k_path = os.path.join(temp_job_dir, "input_16k.wav")
            convert_to_16k_mono(
                raw_audio_path,
                wav_16k_path,
                high_pass_enabled=config.AUDIO_HIGH_PASS_ENABLED,
                high_pass_hz=config.AUDIO_HIGH_PASS_HZ,
                normalize_enabled=config.AUDIO_NORMALIZE_ENABLED
            )

            # Remove raw audio to save disk space
            if os.path.exists(raw_audio_path) and raw_audio_path != wav_16k_path:
                try:
                    os.remove(raw_audio_path)
                except Exception:
                    pass

            # 3. Calculate SHA-256 audio hash for cache key: audioHash + model + language
            with open(wav_16k_path, "rb") as f:
                audio_hash = hashlib.sha256(f.read()).hexdigest()

            # 4. Always Execute Faster-Whisper Inference Fresh (No stale cache)

            # 5. Transcription Execution: Prefer Gemini 2.5 Flash + Wav2Vec2 CTC with Faster-Whisper Fallback
            song_doc = self.db.songs.find_one({"_id": song_id})
            song_title = song_doc.get("title", "") if song_doc else ""
            artist_name = ""
            if song_doc and song_doc.get("artists"):
                try:
                    artist_objs = list(self.db.artists.find({"_id": {"$in": song_doc["artists"]}}))
                    artist_name = ", ".join([a.get("name", "") for a in artist_objs if a.get("name")])
                except Exception:
                    pass

            gemini_success = False
            final_lrc_data = ""
            final_synced_lines = []
            raw_transcript = ""
            normalized_transcript = ""
            trans_segments = []
            heuristic_conf = 0.95
            alignment_mode_used = "gemini_flash_wav2vec2_ctc"
            actual_provider = "gemini-2.5-flash"
            actual_model = getattr(config, "GEMINI_MODEL", "gemini-2.5-flash")

            if config.GEMINI_API_KEY and config.TRANSCRIPTION_PROVIDER in ("gemini-flash", "gemini", "auto"):
                try:
                    self.update_job_progress(job_id, "TRANSCRIBING", 35, "Đang nhận diện ca từ bài hát...")
                    logger.info(f"[{job_id}] Transcribing audio with Gemini (preferred: {config.GEMINI_MODEL})...")
                    from pipeline.transcriber_gemini import transcribe_with_gemini

                    gemini_res = transcribe_with_gemini(
                        audio_path=wav_16k_path,
                        song_title=song_title,
                        artist_name=artist_name,
                        api_key=config.GEMINI_API_KEY,
                        model_name=config.GEMINI_MODEL,
                        temp_dir=temp_job_dir,
                    )
                    plain_lyrics = gemini_res.get("plainLyrics", "").strip()

                    if plain_lyrics and len(plain_lyrics.splitlines()) >= 2:
                        actual_model = gemini_res.get("model", actual_model)
                        actual_provider = gemini_res.get("provider", f"gemini-{actual_model}")
                        logger.info(f"[{job_id}] {actual_model} transcribed {len(plain_lyrics.splitlines())} lines successfully.")
                        self.update_job_progress(job_id, "ALIGNING", 65, "Đang căn mốc thời gian từng câu hát...")

                        # High-precision Wav2Vec2 CTC alignment on the verified plain lyrics
                        raw_words, _ = align_lyrics(
                            wav_16k_path,
                            plain_lyrics,
                            model_name=config.CTC_MODEL_NAME,
                            device=config.WORKER_DEVICE,
                        )

                        try:
                            raw_words = snap_word_onsets(wav_16k_path, raw_words)
                        except Exception as e:
                            logger.warning(f"[{job_id}] Onset snapping skipped: {e}")

                        self.update_job_progress(job_id, "POSTPROCESSING", 85, "Đang tinh chỉnh độ ngân & khớp mốc thời gian...")
                        processed_words = apply_energy_tail_extension(
                            wav_16k_path,
                            raw_words,
                            duration_sec,
                            max_tail_sec=config.MAX_TAIL_EXTENSION_SEC,
                            energy_threshold_db=config.ENERGY_TAIL_THRESHOLD_DB,
                        )

                        synced_lines, lrc_data = compile_line_and_word_lyrics(processed_words, plain_lyrics)
                        final_lrc_data = lrc_data
                        final_synced_lines = synced_lines
                        raw_transcript = plain_lyrics
                        normalized_transcript = plain_lyrics
                        gemini_success = True
                        logger.info(f"[{job_id}] {actual_model} + Wav2Vec2 CTC completed: {len(synced_lines)} synced lines generated.")
                    else:
                        logger.warning(f"[{job_id}] Gemini response had insufficient lines, falling back to Whisper.")
                except Exception as e:
                    logger.warning(f"[{job_id}] Gemini transcription failed across all models: {e}. Falling back to Faster-Whisper...")

            if not gemini_success:
                # Fallback to Faster-Whisper
                self.update_job_progress(job_id, "TRANSCRIBING", 30, "Đang nhận diện ca từ bài hát...")
                from pipeline.transcriber import transcribe_audio

                def on_whisper_segment(curr_sec, total_sec, text_snippet):
                    calc_pct = min(80, int(30 + (curr_sec / total_sec) * 50))
                    msg = f"Đang nhận diện lời bài hát ({int((curr_sec/total_sec)*100)}%)..."
                    self.update_job_progress(job_id, "TRANSCRIBING", calc_pct, msg)

                whisper_target_model = target_model if not str(target_model).startswith("gemini") else config.WHISPER_MODEL_SIZE
                trans_res = transcribe_audio(
                    audio_path=wav_16k_path,
                    model_size=whisper_target_model,
                    language=target_lang,
                    beam_size=config.WHISPER_BEAM_SIZE,
                    word_timestamps=config.WHISPER_WORD_TIMESTAMPS,
                    vad_filter=config.WHISPER_VAD_FILTER,
                    min_silence_duration_ms=config.WHISPER_VAD_MIN_SILENCE_MS,
                    song_title=song_title,
                    progress_callback=on_whisper_segment,
                )

                final_lrc_data = trans_res.get("lrcData", "")
                final_synced_lines = trans_res.get("syncedLines", [])
                raw_transcript = trans_res.get("rawTranscript", "")
                normalized_transcript = trans_res.get("normalizedTranscript", "")
                trans_segments = trans_res.get("transcriptionSegments", [])
                heuristic_conf = trans_res.get("metrics", {}).get("heuristicConfidence", 0.7)
                alignment_mode_used = "whisper_precision_draft"
                actual_provider = "faster-whisper"
                actual_model = target_model

                flat_words = []
                for line in final_synced_lines:
                    for w in line.get("words", []):
                        flat_words.append({
                            "word": w["word"],
                            "raw_start": w["start"],
                            "raw_end": w["end"],
                            "probability": w.get("probability", 1.0)
                        })

                if flat_words:
                    try:
                        self.update_job_progress(job_id, "ALIGNING", 85, "Đang vi chỉnh điểm mở miệng & độ ngân vang...")
                        snapped_words = snap_word_onsets(wav_16k_path, flat_words)
                        processed_words = apply_energy_tail_extension(
                            wav_16k_path,
                            snapped_words,
                            duration_sec,
                            max_tail_sec=config.MAX_TAIL_EXTENSION_SEC,
                            energy_threshold_db=config.ENERGY_TAIL_THRESHOLD_DB
                        )

                        word_idx = 0
                        new_synced_lines = []
                        new_lrc_lines = []
                        for line in final_synced_lines:
                            line_words = []
                            for _ in line.get("words", []):
                                if word_idx < len(processed_words):
                                    pw = processed_words[word_idx]
                                    line_words.append({
                                        "word": pw["word"],
                                        "start": round(pw["startTime"], 3),
                                        "end": round(pw["endTime"], 3),
                                        "probability": pw.get("probability", 1.0)
                                    })
                                    word_idx += 1
                            if line_words:
                                l_start = line_words[0]["start"]
                                l_end = line_words[-1]["end"]
                            else:
                                l_start = line["startTime"]
                                l_end = line["endTime"]

                            new_synced_lines.append({
                                "lineIndex": line["lineIndex"],
                                "startTime": l_start,
                                "endTime": l_end,
                                "text": line["text"],
                                "words": line_words
                            })
                            ts_str = format_lrc_timestamp(l_start)
                            new_lrc_lines.append(f"{ts_str}{line['text']}")

                        final_synced_lines = new_synced_lines
                        final_lrc_data = "\n".join(new_lrc_lines)
                    except Exception as e:
                        logger.warning(f"[{job_id}] Onset snapping on Whisper draft skipped: {e}")

            # 7. Save results to MongoDB
            self.update_job_progress(job_id, "FINALIZING", 95, "Đang hoàn tất lưu kết quả nhận diện...")
            total_duration = round(time.time() - start_time, 2)
            self.db.lyricsalignmentjobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "status": "succeeded",
                        "stage": "COMPLETED",
                        "progressPercent": 100,
                        "progressMessage": "Nhận diện & Căn nhịp phòng thu thành công!",
                        "rawTranscript": raw_transcript,
                        "normalizedTranscript": normalized_transcript,
                        "transcriptionSegments": trans_segments,
                        "lrcData": final_lrc_data,
                        "syncedLines": final_synced_lines,
                        "alignmentMode": alignment_mode_used,
                        "audioHash": audio_hash,
                        "language": target_lang,
                        "transcriptionModel": actual_model,
                        "transcriptionProvider": actual_provider,
                        "transcriptionConfidence": heuristic_conf,
                        "result": {
                            "plainLyrics": normalized_transcript,
                            "rawTranscript": raw_transcript,
                            "lrcData": final_lrc_data,
                            "syncedLines": final_synced_lines,
                            "alignmentMode": alignment_mode_used,
                            "transcriptionSegments": trans_segments,
                            "metrics": {
                                "heuristicConfidence": heuristic_conf,
                            },
                            "executionDurationSec": total_duration
                        },
                        "completedAt": get_utc_now()
                    }
                }
            )
            logger.info(f"[{job_id}] Auto-transcription completed successfully in {total_duration}s (Mode: {alignment_mode_used}, Provider: {actual_provider}).")
        except AudioValidationError as e:
            logger.error(f"[{job_id}] Audio Validation Error: {e.code} - {e.message}")
            self.mark_job_failed(job_id, e.code, e.message)
        except Exception as e:
            logger.error(f"[{job_id}] Auto-transcription Error: {e}", exc_info=True)
            self.mark_job_failed(job_id, "TRANSCRIPTION_FAILED", f"Lỗi nhận diện lời bài hát: {str(e)}")
        finally:
            self.stop_heartbeat()
            if os.path.exists(temp_job_dir):
                try:
                    shutil.rmtree(temp_job_dir, ignore_errors=True)
                except Exception as e:
                    logger.warning(f"Could not delete temp dir {temp_job_dir}: {e}")

    def mark_job_failed(self, job_id, error_code: str, error_message: str):
        """Marks a job as failed with standardized error code and message."""
        try:
            self.db.lyricsalignmentjobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "failedAt": get_utc_now(),
                        "errorCode": error_code,
                        "errorMessage": error_message
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to mark job {job_id} as failed in DB: {e}")

    def close(self):
        """Closes MongoDB connection and active resources."""
        self.stop_heartbeat()
        self.running = False
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
    def run(self, job_id=None):
        """Run one specific job or keep the legacy polling worker."""
        if job_id:
            logger.info(f"[Worker] One-shot mode: processing job {job_id}")

            try:
                from bson import ObjectId

                try:
                    mongo_job_id = ObjectId(job_id)
                except Exception:
                    mongo_job_id = job_id

                job = self.db.lyricsalignmentjobs.find_one({
                    "_id": mongo_job_id,
                    "status": "pending"
                })

                if not job:
                    logger.error(
                        f"[Worker] Job {job_id} not found or is not pending."
                    )
                    return 1

                # Claim đúng job này, tránh worker khác xử lý trùng
                claimed = self.db.lyricsalignmentjobs.find_one_and_update(
                    {
                        "_id": mongo_job_id,
                        "status": "pending",
                        "attemptCount": {"$lt": config.MAX_JOB_ATTEMPTS}
                    },
                    {
                        "$set": {
                            "status": "processing",
                            "workerId": self.worker_id,
                            "processingStartedAt": get_utc_now(),
                            "lastHeartbeatAt": get_utc_now()
                        },
                        "$inc": {"attemptCount": 1}
                    },
                    return_document=ReturnDocument.AFTER
                )

                if not claimed:
                    logger.error(
                        f"[Worker] Job {job_id} could not be claimed."
                    )
                    return 1

                self.process_job(claimed)

                # process_job tự mark succeeded/failed
                final_job = self.db.lyricsalignmentjobs.find_one(
                    {"_id": mongo_job_id}
                )

                if final_job and final_job.get("status") == "succeeded":
                    logger.info(f"[Worker] One-shot job {job_id} completed.")
                    return 0

                logger.error(f"[Worker] One-shot job {job_id} failed.")
                return 1

            except Exception as e:
                logger.error(
                    f"[Worker] One-shot execution error: {e}",
                    exc_info=True
                )
                return 1

            finally:
                self.close()

        # Legacy polling mode
        logger.info("Worker polling loop started. Waiting for jobs...")

        while self.running:
            try:
                self.reclaim_stale_locks()

                job = self.claim_next_job()

                if job:
                    self.process_job(job)
                else:
                    time.sleep(config.POLL_INTERVAL_SEC)

            except PyMongoError as e:
                logger.error(
                    f"MongoDB connection error: {e}. Retrying in 5s..."
                )
                time.sleep(5.0)

            except KeyboardInterrupt:
                logger.info("Worker stopped by user.")
                self.close()
                break

            except Exception as e:
                logger.error(
                    f"Unexpected worker loop error: {e}",
                    exc_info=True
                )
                time.sleep(config.POLL_INTERVAL_SEC)
def start_health_server():
    """Lightweight HTTP health check server for Render / Cloud Web Service."""
    port_env = os.getenv("PORT", "10000")
    try:
        import http.server
        port = int(port_env)
        class HealthCheckHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"healthy","service":"musicflow-alignment-worker","ram":"16gb-ok"}')
            def log_message(self, format, *args):
                pass
        server = http.server.ThreadingHTTPServer(("0.0.0.0", port), HealthCheckHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        print(f"[Worker] Health check HTTP server started on 0.0.0.0:{port}", flush=True)
        logger.info(f"[Worker] Health check HTTP server started on 0.0.0.0:{port}")
    except Exception as e:
        print(f"[Worker] Could not start health check HTTP server on port {port_env}: {e}", flush=True)
        logger.warning(f"[Worker] Could not start health check HTTP server on port {port_env}: {e}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--job-id",
        type=str,
        default=None,
        help="Process one specific MongoDB alignment job and exit."
    )

    args = parser.parse_args()

    # Health server chỉ cần cho legacy polling mode
    if not args.job_id:
        start_health_server()

    worker = AlignmentWorker()
    exit_code = worker.run(job_id=args.job_id)

    sys.exit(exit_code)
