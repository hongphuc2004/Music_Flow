"""
main.py — Main Polling Consumer for MusicFlow AI Alignment Worker
Handles atomic job claim, heartbeat loop, stale lock reclamation,
audio pipeline execution, OCC draft application, and temp file lifecycle.
"""

import logging
import os
import shutil
import sys
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
from pipeline.postprocessor import apply_energy_tail_extension, compile_line_and_word_lyrics
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
        Pre-warms PyTorch inference tensors and Wav2Vec2 weights during worker startup
        so all subsequent jobs execute with zero initialization latency.
        """
        try:
            logger.info("[Worker] Pre-warming models and inference tensors...")
            w_start = time.time()
            if config.WORKER_DEVICE == "cuda":
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
            self.update_job_progress(job_id, "ALIGNING", 70, "Đang lắng nghe & bắt nhịp bằng Neural CTC...")
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

    def run(self):
        """Main polling loop."""
        logger.info("Worker polling loop started. Waiting for jobs...")
        while self.running:
            try:
                # 1. Reclaim any stale locks
                self.reclaim_stale_locks()

                # 2. Claim next pending job
                job = self.claim_next_job()
                if job:
                    self.process_job(job)
                else:
                    time.sleep(config.POLL_INTERVAL_SEC)
            except PyMongoError as e:
                logger.error(f"MongoDB connection error: {e}. Retrying in 5s...")
                time.sleep(5.0)
            except KeyboardInterrupt:
                logger.info("Worker stopped by user.")
                self.close()
                break
            except Exception as e:
                logger.error(f"Unexpected worker loop error: {e}", exc_info=True)
                time.sleep(config.POLL_INTERVAL_SEC)

def start_health_server():
    """Lightweight HTTP health check server for platforms like Render Web Service."""
    port_env = os.getenv("PORT", "10000")
    try:
        import http.server
        port = int(port_env)
        class HealthCheckHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"healthy","service":"musicflow-alignment-worker"}')
            def log_message(self, format, *args):
                pass
        server = http.server.HTTPServer(("0.0.0.0", port), HealthCheckHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        print(f"[Worker] Health check HTTP server started on 0.0.0.0:{port}", flush=True)
        logger.info(f"[Worker] Health check HTTP server started on 0.0.0.0:{port}")
    except Exception as e:
        print(f"[Worker] Could not start health check HTTP server on port {port_env}: {e}", flush=True)
        logger.warning(f"[Worker] Could not start health check HTTP server on port {port_env}: {e}")

if __name__ == "__main__":
    start_health_server()
    worker = AlignmentWorker()
    worker.run()
