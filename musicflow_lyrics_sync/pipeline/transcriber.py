"""
transcriber.py — Faster-Whisper ASR Audio-to-Lyrics Draft Transcriber for MusicFlow
Uses CTranslate2 C++ engine with CPU INT8 quantization and Silero VAD filter.

Core Philosophy:
- Audio -> Faster-Whisper -> Transcript Draft + rough timestamps
- Artist -> Review & Edit text
- Wav2Vec2 CTC -> Final Forced Alignment (Karaoke LRC)
"""

import logging
import math
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

import config

logger = logging.getLogger("AlignmentWorker.Transcriber")


class WhisperTranscriberError(Exception):
    """Raised when transcription fails."""
    pass


class WhisperTranscriberManager:
    """
    Singleton Manager for Faster-Whisper Model Lifecycle.
    Lazy-loads the CTranslate2 model to keep boot memory minimal.
    """
    _instance: Optional["WhisperTranscriberManager"] = None
    _model = None
    _loaded_model_size: Optional[str] = None

    @classmethod
    def get_instance(cls) -> "WhisperTranscriberManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    VALID_WHISPER_MODELS = {
        "tiny.en", "tiny", "base.en", "base", "small.en", "small",
        "medium.en", "medium", "large-v1", "large-v2", "large-v3",
        "large", "distil-large-v2", "distil-medium.en", "distil-small.en",
        "distil-large-v3", "distil-large-v3.5", "large-v3-turbo", "turbo"
    }

    def get_model(self, model_size: Optional[str] = None):
        target_size = model_size or config.WHISPER_MODEL_SIZE
        if not target_size or target_size not in self.VALID_WHISPER_MODELS:
            target_size = config.WHISPER_MODEL_SIZE if config.WHISPER_MODEL_SIZE in self.VALID_WHISPER_MODELS else "medium"

        # If model is already loaded with the same size, reuse it
        if self._model is not None and self._loaded_model_size == target_size:
            return self._model

        from faster_whisper import WhisperModel

        logger.info(
            f"[Transcriber] Loading Faster-Whisper model '{target_size}' "
            f"(device={config.WORKER_DEVICE}, compute_type={config.WHISPER_COMPUTE_TYPE}, "
            f"cpu_threads={config.WHISPER_CPU_THREADS})..."
        )

        try:
            self._model = WhisperModel(
                target_size,
                device=config.WORKER_DEVICE,
                compute_type=config.WHISPER_COMPUTE_TYPE,
                cpu_threads=config.WHISPER_CPU_THREADS,
            )
            self._loaded_model_size = target_size
            logger.info(f"[Transcriber] Faster-Whisper model '{target_size}' loaded successfully.")
            return self._model
        except Exception as e:
            logger.error(f"[Transcriber] Failed to load Faster-Whisper model '{target_size}': {e}")
            raise WhisperTranscriberError(f"Không thể khởi tạo Faster-Whisper model '{target_size}': {e}")


def normalize_lyrics_text(text: str) -> str:
    """
    Normalizes transcript text:
    - Unicode NFC normalization (preserving Vietnamese diacritics and tone marks)
    - Trims extraneous whitespace per line
    - Strips empty lines and removes excessive inline spaces
    """
    if not isinstance(text, str):
        return ""
    text = unicodedata.normalize("NFC", text)
    lines = []
    for raw_line in text.splitlines():
        cleaned = re.sub(r"[ \t]+", " ", raw_line).strip()
        if cleaned:
            lines.append(cleaned)
    return "\n".join(lines)


HALLUCINATION_REGEX = re.compile(
    r"(subscribe|đăng ký kênh|ghiền mì gõ|video hấp dẫn|like và share|like share|bấm chuông|rung chuông|nhấn chuông|theo dõi kênh|hãy theo dõi|xem video|kênh của chúng tôi|nhớ bấm|ủng hộ kênh|phụ đề|subtitles by|chúc các bạn|cảm ơn các bạn|đừng quên bấm|đừng quên like|bản quyền thuộc|chia sẻ video)",
    re.IGNORECASE,
)


def is_hallucination(text: str) -> bool:
    if not text:
        return True
    return bool(HALLUCINATION_REGEX.search(text))


def format_lrc_timestamp(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    cs = int(round((seconds % 1) * 100))
    if cs >= 100:
        s += 1
        cs = 0
    return f"[{m:02d}:{s:02d}.{cs:02d}]"


def calculate_heuristic_confidence(avg_logprob: float, no_speech_prob: float, compression_ratio: float) -> float:
    """
    Calculates an internal heuristic confidence score in range [0.1, 1.0].
    NOTE: This is strictly an internal heuristic score based on acoustic signals,
    NOT a literal mathematical probability that the transcript is 100% accurate.
    """
    try:
        base = math.exp(max(-2.5, min(0.0, avg_logprob)))
    except Exception:
        base = 0.5

    if no_speech_prob > 0.4:
        base *= max(0.2, 1.0 - (no_speech_prob - 0.4) * 1.5)

    if compression_ratio > 2.2:
        base *= max(0.3, 1.0 - (compression_ratio - 2.2) * 0.4)

    return round(max(0.1, min(1.0, base)), 4)


def align_single_segment_ctc(
    audio_slice: Any,
    offset_sec: float,
    seg_text: str,
    session: Any,
    tokenizer: Any,
    input_name: str,
    sr: int = 16000,
) -> Optional[Dict[str, Any]]:
    """
    Runs high-speed local Wav2Vec2 CTC alignment on a single transcribed line.
    Takes ~0.08s, accurately pinpointing the exact vocal onset and offset.
    """
    try:
        from pipeline.aligner import VietnameseTextNormalizer, TrellisDynamicProgramming, ViterbiBacktracker
        if len(audio_slice) < int(0.3 * sr):
            return None

        chunk_input = audio_slice[np.newaxis, :].astype(np.float32)
        onnx_outputs = session.run(None, {input_name: chunk_input})
        logits_np = onnx_outputs[0][0]

        max_logits = np.max(logits_np, axis=-1, keepdims=True)
        exp_logits = np.exp(logits_np - max_logits)
        sum_exp = np.sum(exp_logits, axis=-1, keepdims=True)
        emissions_np = (logits_np - max_logits) - np.log(sum_exp)

        raw_lines, line_words_map = VietnameseTextNormalizer.extract_words_and_lines(seg_text)
        if not line_words_map:
            return None
        flat_words = [w for line in line_words_map for w in line]
        token_ids: List[int] = []
        token_to_word_map: List[int] = []

        for w_idx, w_info in enumerate(flat_words):
            word_text = w_info["normalized_text"]
            for c in word_text:
                token_ids.append(tokenizer.vocab.get(c, tokenizer.unk_token_id))
                token_to_word_map.append(w_idx)
            token_ids.append(tokenizer.space_id)
            token_to_word_map.append(w_idx)

        if token_ids and token_ids[-1] == tokenizer.space_id:
            token_ids.pop()
            token_to_word_map.pop()

        T = emissions_np.shape[0]
        N = len(token_ids)
        if T < N or N == 0:
            return None

        trellis = TrellisDynamicProgramming.build_trellis(emissions_np, token_ids)
        token_spans = ViterbiBacktracker.backtrack(trellis, emissions_np, token_ids)

        if not token_spans:
            return None

        word_spans_dict: Dict[int, Dict[str, Any]] = {}
        for sp in token_spans:
            t_idx = sp["token_seq_idx"]
            if t_idx < len(token_to_word_map):
                w_idx = token_to_word_map[t_idx]
                if w_idx not in word_spans_dict:
                    word_spans_dict[w_idx] = {
                        "start_frame": sp["start_frame"],
                        "end_frame": sp["end_frame"],
                        "scores": [sp["log_prob"]],
                    }
                else:
                    word_spans_dict[w_idx]["end_frame"] = max(word_spans_dict[w_idx]["end_frame"], sp["end_frame"])
                    word_spans_dict[w_idx]["scores"].append(sp["log_prob"])

        refined_words = []
        for w_idx, w_info in enumerate(flat_words):
            sp_info = word_spans_dict.get(w_idx)
            if sp_info:
                w_start = round(offset_sec + (sp_info["start_frame"] * 0.02), 3)
                w_end = round(offset_sec + (sp_info["end_frame"] * 0.02), 3)
                refined_words.append({
                    "word": w_info["text"],
                    "start": w_start,
                    "end": max(w_start + 0.1, w_end),
                    "probability": 0.95,
                })
            else:
                refined_words.append({
                    "word": w_info["text"],
                    "start": round(offset_sec, 3),
                    "end": round(offset_sec + 0.3, 3),
                    "probability": 0.8,
                })

        line_start = refined_words[0]["start"] if refined_words else offset_sec
        line_end = refined_words[-1]["end"] if refined_words else offset_sec + len(audio_slice) / sr

        return {
            "start": round(line_start, 3),
            "end": round(line_end, 3),
            "words": refined_words,
        }
    except Exception as e:
        logger.debug(f"[Transcriber] Single segment CTC alignment skipped: {e}")
        return None


def transcribe_audio(
    audio_path: str,
    model_size: Optional[str] = None,
    language: Optional[str] = None,
    beam_size: Optional[int] = None,
    word_timestamps: Optional[bool] = None,
    vad_filter: Optional[bool] = None,
    min_silence_duration_ms: Optional[int] = None,
    song_title: Optional[str] = None,
    progress_callback: Optional[Any] = None,
) -> Dict[str, Any]:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Không tìm thấy file âm thanh: {audio_path}")

    target_model_size = model_size or config.WHISPER_MODEL_SIZE
    target_language = language or config.WHISPER_LANGUAGE
    target_beam_size = beam_size if beam_size is not None else config.WHISPER_BEAM_SIZE
    target_word_timestamps = word_timestamps if word_timestamps is not None else config.WHISPER_WORD_TIMESTAMPS
    target_vad_filter = vad_filter if vad_filter is not None else config.WHISPER_VAD_FILTER
    target_min_silence = min_silence_duration_ms if min_silence_duration_ms is not None else config.WHISPER_VAD_MIN_SILENCE_MS

    manager = WhisperTranscriberManager.get_instance()
    model = manager.get_model(target_model_size)

    target_speech_pad = getattr(config, "WHISPER_VAD_SPEECH_PAD_MS", 300)
    vad_params = dict(
        min_silence_duration_ms=target_min_silence or 400,
        speech_pad_ms=target_speech_pad,
    ) if target_vad_filter else None

    logger.info(
        f"[Transcriber] Starting transcription on '{os.path.basename(audio_path)}' "
        f"with model='{target_model_size}', lang='{target_language}', beam={target_beam_size}, "
        f"vad={target_vad_filter}, word_ts={target_word_timestamps}"
    )

    # Load audio into 16kHz float32 numpy array for maximum stability and speed
    input_audio = audio_path
    try:
        import soundfile as sf
        audio_data, sr = sf.read(audio_path, dtype="float32")
        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=1)
        if sr != 16000:
            import librosa
            audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)
        input_audio = audio_data
    except Exception as e:
        logger.debug(f"[Transcriber] Soundfile/librosa preload skipped, falling back to file path: {e}")
        input_audio = audio_path

    context_prompt = (
        f"Lời bài hát '{song_title}', ca khúc âm nhạc Việt Nam. Lời ca chuẩn ngữ nghĩa tiếng Việt."
        if song_title
        else "Lời bài hát ca khúc âm nhạc Việt Nam. Lời ca chuẩn ngữ nghĩa tiếng Việt."
    )

    try:
        segments_gen, info = model.transcribe(
            input_audio,
            language=target_language,
            beam_size=target_beam_size,
            word_timestamps=True,
            vad_filter=target_vad_filter,
            vad_parameters=vad_params,
            initial_prompt=context_prompt,
            condition_on_previous_text=True,
            repetition_penalty=getattr(config, "WHISPER_REPETITION_PENALTY", 1.15),
            hallucination_silence_threshold=getattr(config, "WHISPER_HALLUCINATION_SILENCE_THRESHOLD", 2.0),
            temperature=[0.0, 0.2, 0.4],
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
        )
    except Exception as e:
        logger.error(f"[Transcriber] Error initializing Whisper inference: {e}", exc_info=True)
        raise WhisperTranscriberError(f"Lỗi suy luận Faster-Whisper: {e}")

    total_duration = getattr(info, "duration", 0.0) or 1.0
    logger.info(
        f"[Transcriber] Audio loaded: duration={total_duration:.1f}s, "
        f"language={getattr(info, 'language', target_language)} ({getattr(info, 'language_probability', 1.0):.1%})"
    )

    transcription_segments: List[Dict[str, Any]] = []
    raw_lines: List[str] = []
    lrc_lines: List[str] = []
    synced_lines: List[Dict[str, Any]] = []
    total_logprob = 0.0
    total_no_speech = 0.0
    total_comp_ratio = 0.0

    seg_index = 0
    for seg in segments_gen:
        raw_text = seg.text.strip() if seg.text else ""
        if not raw_text:
            continue

        pct = min(99, int((seg.end / total_duration) * 100))
        m_s, s_s = int(seg.start // 60), int(seg.start % 60)
        m_e, s_e = int(seg.end // 60), int(seg.end % 60)
        time_tag = f"{m_s:02d}:{s_s:02d} -> {m_e:02d}:{s_e:02d}"

        # Filter out common YouTube subtitle hallucinations on quiet audio
        if is_hallucination(raw_text):
            logger.info(f"[Transcriber] [Bỏ qua rác] [{pct}%] [{time_tag}] '{raw_text}'")
            continue

        seg_text = raw_text

        seg_index += 1
        words_data: List[Dict[str, Any]] = []

        if getattr(seg, "words", None):
            for w in seg.words:
                w_text = w.word.strip() if w.word else ""
                if w_text and not is_hallucination(w_text):
                    words_data.append({
                        "word": w_text,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(getattr(w, "probability", 1.0), 4),
                    })

        final_start = words_data[0]["start"] if words_data else seg.start
        final_end = words_data[-1]["end"] if words_data else seg.end

        logger.info(f"[Transcriber] [Câu {seg_index:02d}] [{pct:>2}%] [Whisper Medium Beam={target_beam_size}] [{format_lrc_timestamp(final_start)}] '{seg_text}'")

        if progress_callback:
            try:
                progress_callback(seg.end, total_duration, seg_text)
            except Exception:
                pass

        seg_dict = {
            "id": len(transcription_segments),
            "start": round(final_start, 3),
            "end": round(final_end, 3),
            "text": seg_text,
            "avgLogProb": round(getattr(seg, "avg_logprob", 0.0), 4),
            "noSpeechProb": round(getattr(seg, "no_speech_prob", 0.0), 4),
            "compressionRatio": round(getattr(seg, "compression_ratio", 1.0), 4),
            "words": words_data,
        }
        transcription_segments.append(seg_dict)
        raw_lines.append(seg_text)

        ts_str = format_lrc_timestamp(final_start)
        lrc_lines.append(f"{ts_str}{seg_text}")

        synced_lines.append({
            "lineIndex": len(synced_lines),
            "startTime": round(final_start, 3),
            "endTime": round(final_end, 3),
            "text": seg_text,
            "words": words_data,
        })

        total_logprob += getattr(seg, "avg_logprob", 0.0)
        total_no_speech += getattr(seg, "no_speech_prob", 0.0)
        total_comp_ratio += getattr(seg, "compression_ratio", 1.0)

    num_segs = max(1, len(transcription_segments))
    avg_logprob = round(total_logprob / num_segs, 4)
    avg_no_speech = round(total_no_speech / num_segs, 4)
    avg_comp_ratio = round(total_comp_ratio / num_segs, 4)

    raw_transcript = "\n".join(raw_lines)
    normalized_transcript = normalize_lyrics_text(raw_transcript)
    lrc_data = "\n".join(lrc_lines)
    heuristic_conf = calculate_heuristic_confidence(avg_logprob, avg_no_speech, avg_comp_ratio)

    logger.info(
        f"[Transcriber] Transcription finished: {len(transcription_segments)} segments, "
        f"{len(raw_lines)} lines, avgLogProb={avg_logprob}, noSpeechProb={avg_no_speech}, "
        f"heuristicConfidence={heuristic_conf}"
    )

    return {
        "rawTranscript": raw_transcript,
        "normalizedTranscript": normalized_transcript,
        "lrcData": lrc_data,
        "syncedLines": synced_lines,
        "transcriptionSegments": transcription_segments,
        "alignmentMode": "whisper_rough",
        "language": getattr(info, "language", target_language),
        "languageProbability": round(getattr(info, "language_probability", 1.0), 4),
        "duration": round(getattr(info, "duration", 0.0), 2),
        "transcriptionModel": target_model_size,
        "transcriptionProvider": "faster-whisper",
        "metrics": {
            "avgLogProb": avg_logprob,
            "noSpeechProb": avg_no_speech,
            "compressionRatio": avg_comp_ratio,
            "heuristicConfidence": heuristic_conf,
        },
    }
