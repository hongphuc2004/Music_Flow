"""
transcriber_gemini.py — Google Gemini 2.5 Flash Audio-to-Lyrics Transcriber for MusicFlow

Uses Gemini 2.5 Flash Multimodal Audio API to transcribe Vietnamese singing vocals
with high semantic accuracy, natural poetic verse segmentation, and zero hallucination.
"""

import base64
import logging
import os
import re
import subprocess
import time
import unicodedata
from typing import Any, Dict, List, Optional

import requests

import config

logger = logging.getLogger("AlignmentWorker.GeminiTranscriber")

MAX_INLINE_BYTES = 18 * 1024 * 1024  # 18 MB max for base64 inline audio


def _normalize_lyrics_text(text: str) -> str:
    """
    Cleans transcript text:
    - Strips markdown codeblocks
    - Strips metadata headers like [Verse 1], [Chorus], [Điệp khúc], [Intro], [Outro]
    - Strips leading numbers or bullet points
    - Strips non-lyrics metadata lines (e.g. "Sáng tác:", "Ca sĩ:")
    - Unicode NFC normalization
    - Removes empty lines and excessive whitespace
    """
    if not isinstance(text, str):
        return ""

    # Strip markdown code blocks if wrapped
    text = re.sub(r"^```[a-zA-Z0-9_-]*\n", "", text, flags=re.MULTILINE)
    text = re.sub(r"```$", "", text, flags=re.MULTILINE)

    # Unicode NFC normalization
    text = unicodedata.normalize("NFC", text)

    lines = []
    metadata_patterns = [
        re.compile(r"^(sáng tác|nhạc sĩ|ca sĩ|thể hiện|bài hát|lời bài hát|lyrics|track|intro|outro|verse|chorus|bridge|pre-chorus|điệp khúc|đoạn \d+|lời \d+)[\s:]+", re.IGNORECASE),
        re.compile(r"^\[(intro|outro|verse|chorus|bridge|pre-chorus|điệp khúc|đoạn \d+|lời \d+|nhạc dạo|solo|beat|giang tấu)[^\]]*\]", re.IGNORECASE),
        re.compile(r"^\((intro|outro|verse|chorus|bridge|pre-chorus|điệp khúc|đoạn \d+|lời \d+|nhạc dạo|solo|beat|giang tấu)[^\)]*\)", re.IGNORECASE),
    ]

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Skip metadata header lines
        if any(pat.match(line) for pat in metadata_patterns):
            continue

        # Strip line numbers like "1. ", "1 - ", "(1) "
        line = re.sub(r"^(\d+[\.\-\)]|\(\d+\))\s*", "", line).strip()

        # Strip standalone brackets like "[...]" if it was just a label
        if re.match(r"^\[.*\]$", line) or re.match(r"^\(.*\)$", line):
            continue

        # Strip remaining typographic artifacts
        line = re.sub(r"[ \t]+", " ", line)

        if line:
            lines.append(line)

    return "\n".join(lines)


def _prepare_audio_base64(audio_path: str, temp_dir: Optional[str] = None) -> tuple[str, str]:
    """
    Reads audio and returns (base64_data, mime_type).
    If audio exceeds MAX_INLINE_BYTES, compresses down to lightweight mono mp3 via ffmpeg.
    """
    ext = os.path.splitext(audio_path)[1].lower()
    mime_type = "audio/wav" if ext == ".wav" else ("audio/mp3" if ext in (".mp3", ".mpeg") else "audio/wav")

    file_size = os.path.getsize(audio_path)
    if file_size <= MAX_INLINE_BYTES:
        with open(audio_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8"), mime_type

    # Compress large audio file to 48kbps mono MP3 using ffmpeg
    logger.info(f"[GeminiTranscriber] Audio file ({file_size / (1024*1024):.1f}MB) exceeds limit. Compressing to lightweight MP3...")
    work_dir = temp_dir or os.path.dirname(audio_path)
    compressed_path = os.path.join(work_dir, "gemini_compressed.mp3")

    cmd = [
        "ffmpeg", "-y", "-i", audio_path,
        "-ac", "1", "-ar", "16000",
        "-b:a", "48k",
        "-vn", compressed_path
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        with open(compressed_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")
        if os.path.exists(compressed_path):
            try:
                os.remove(compressed_path)
            except Exception:
                pass
        return b64_data, "audio/mp3"
    except Exception as e:
        logger.warning(f"[GeminiTranscriber] FFmpeg compression failed ({e}), using original file.")
        with open(audio_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8"), mime_type


def transcribe_with_gemini(
    audio_path: str,
    song_title: str = "",
    artist_name: str = "",
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    temp_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Transcribes audio using Google Gemini 2.5 Flash REST API.

    Returns dict with:
      - plainLyrics: Cleaned, line-by-line Vietnamese lyrics
      - rawText: Raw response from Gemini
      - lines: List of cleaned lyric lines
      - model: Model name used
      - provider: "gemini-2.5-flash"
    """
    target_key = api_key or getattr(config, "GEMINI_API_KEY", "")
    if not target_key:
        raise ValueError("Thiếu GEMINI_API_KEY để gọi Gemini ASR.")

    preferred_model = model_name or getattr(config, "GEMINI_MODEL", "gemini-2.5-flash")
    fallback_pool = getattr(config, "GEMINI_FALLBACK_MODELS", ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"])

    # Build prioritized list of models to try
    models_to_try = [preferred_model] + [m for m in fallback_pool if m != preferred_model]

    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Không tìm thấy file âm thanh: {audio_path}")

    b64_audio, mime_type = _prepare_audio_base64(audio_path, temp_dir)

    title_part = f"'{song_title}'" if song_title else "bài hát"
    artist_part = f" do ca sĩ '{artist_name}' thể hiện" if artist_name else ""

    prompt = f"""Bạn là một chuyên gia thẩm âm và bóc tách ca từ âm nhạc Việt Nam chuẩn mực.
Dưới đây là tệp âm thanh của {title_part}{artist_part}.

Nhiệm vụ của bạn:
1. Lắng nghe thật kỹ toàn bộ giai điệu, câu từ của ca khúc từ đầu đến cuối.
2. Bóc tách và viết lại TOÀN BỘ lời bài hát (lyrics) bằng tiếng Việt thật chuẩn xác, đúng chính tả, đúng ngữ pháp, thanh điệu và ngữ cảnh ca từ.
3. QUY TẮC ĐỊNH DẠNG CỰC KỲ QUAN TRỌNG:
   - Hãy ngắt dòng theo từng câu hát tự nhiên của ca sĩ (mỗi dòng từ 5 đến 12 từ, tương ứng với một nhịp hát).
   - Tuyệt đối KHÔNG gộp nhiều câu hát thành đoạn văn xuôi dài.
   - KHÔNG tự tạo mốc thời gian timestamp, KHÔNG tạo nhãn [Intro], [Verse], [Chorus], [Điệp khúc], [Outro].
   - KHÔNG đánh số thứ tự đầu dòng, không đặt dấu ngoặc kép.
   - CHỈ trả về duy nhất nội dung lời bài hát tiếng Việt, không kèm lời chào hay giải thích gì thêm.

Bắt đầu nội dung lời bài hát:"""

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_audio,
                        }
                    },
                    {
                        "text": prompt,
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4096,
        },
    }

    last_error = None
    for current_model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={target_key}"
        logger.info(
            f"[GeminiTranscriber] Attempting transcription with '{current_model}' "
            f"({mime_type}, {len(b64_audio)//1024} KB, Title='{song_title}', Artist='{artist_name}')..."
        )

        try:
            t0 = time.time()
            res = requests.post(url, json=payload, timeout=60)
            elapsed = time.time() - t0

            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise ValueError(f"Model '{current_model}' không trả về candidate nào.")

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise ValueError(f"Model '{current_model}' trả về nội dung rỗng.")

                raw_text = parts[0].get("text", "").strip()
                cleaned_text = _normalize_lyrics_text(raw_text)
                lines = [l for l in cleaned_text.splitlines() if l.strip()]

                if not lines:
                    raise ValueError(f"Model '{current_model}' trả về lời không thể phân tích thành dòng.")

                logger.info(
                    f"[GeminiTranscriber] Model '{current_model}' responded successfully in {elapsed:.2f}s: "
                    f"{len(lines)} lines, {len(cleaned_text)} chars."
                )

                return {
                    "plainLyrics": cleaned_text,
                    "rawText": raw_text,
                    "lines": lines,
                    "model": current_model,
                    "provider": f"gemini-{current_model}",
                    "durationSec": round(elapsed, 2),
                }

            elif res.status_code == 429:
                err_snippet = res.text[:200]
                logger.warning(
                    f"[GeminiTranscriber] Model '{current_model}' hit Quota / Rate limit (429: {err_snippet}). "
                    f"Falling back to next candidate model..."
                )
                last_error = f"Quota/RateLimit 429 on {current_model}"
                continue

            elif res.status_code == 503:
                logger.warning(
                    f"[GeminiTranscriber] Model '{current_model}' is overloaded (503). "
                    f"Falling back to next candidate model..."
                )
                last_error = f"Overloaded 503 on {current_model}"
                continue

            else:
                err_msg = f"HTTP {res.status_code}: {res.text[:200]}"
                logger.warning(f"[GeminiTranscriber] Model '{current_model}' failed ({err_msg}). Trying fallback...")
                last_error = err_msg
                continue

        except Exception as e:
            logger.warning(f"[GeminiTranscriber] Error with '{current_model}': {e}. Trying fallback...")
            last_error = str(e)
            continue

    raise RuntimeError(
        f"Tất cả model Gemini trong danh sách {models_to_try} đều không thành công. Lỗi cuối: {last_error}"
    )
