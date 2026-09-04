"""
downloader.py — Downloads and validates audio assets based on audioPublicId
"""

import os
import requests
import soundfile as sf
from typing import Tuple

class AudioValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

def download_audio_asset(
    db,
    song_id,
    audio_public_id: str,
    output_dir: str,
    max_duration_sec: int = 420
) -> Tuple[str, float]:
    """
    Downloads audio file for a song using audioPublicId verification.
    Validates file integrity and duration limit.
    Returns: (audio_path, duration_sec)
    """
    os.makedirs(output_dir, exist_ok=True)
    destination_path = os.path.join(output_dir, "input_raw.audio")

    # 1. Fetch song document from MongoDB to get audioUrl and verify audioPublicId
    song_doc = db.songs.find_one({"_id": song_id})
    if not song_doc:
        raise AudioValidationError("AUDIO_NOT_FOUND", f"Không tìm thấy thông tin bài hát {song_id}")

    # Verify audio public id matches or fallback to URL
    db_audio_public_id = song_doc.get("audioPublicId")
    audio_url = song_doc.get("audioUrl")

    if not audio_url:
        raise AudioValidationError("AUDIO_NOT_FOUND", "Bài hát không có URL âm thanh hợp lệ")

    if db_audio_public_id and db_audio_public_id != audio_public_id and audio_public_id != audio_url:
        raise AudioValidationError("AUDIO_INVALID", "Định danh âm thanh audioPublicId không khớp với bản thu hiện tại")

    # Fast validation: check duration in DB metadata upfront before downloading
    db_duration = float(song_doc.get("duration") or 0.0)
    if db_duration > max_duration_sec:
        raise AudioValidationError(
            "AUDIO_TOO_LONG",
            f"Thời lượng bài hát ({round(db_duration, 1)}s) vượt quá giới hạn tối đa cho phép ({max_duration_sec}s)"
        )

    # 2. Download audio stream
    try:
        response = requests.get(audio_url, stream=True, timeout=30)
        if response.status_code != 200:
            raise AudioValidationError(
                "AUDIO_DOWNLOAD_FAILED",
                f"Tải tệp âm thanh thất bại (HTTP {response.status_code})"
            )

        with open(destination_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
    except requests.RequestException as e:
        raise AudioValidationError("AUDIO_DOWNLOAD_FAILED", f"Lỗi kết nối khi tải âm thanh: {str(e)}")

    # 3. Validate audio file readability and duration
    try:
        info = sf.info(destination_path)
        duration_sec = float(info.duration)
    except Exception as e:
        # If soundfile fails directly on mp3/m4a, soundfile might need ffmpeg or libsndfile
        # We can also check with mutagen or ffmpeg info if available
        duration_sec = float(song_doc.get("duration") or 0.0)
        if duration_sec <= 0.0:
            raise AudioValidationError("AUDIO_INVALID", f"Tệp âm thanh bị lỗi hoặc không thể đọc: {str(e)}")

    if duration_sec > max_duration_sec:
        raise AudioValidationError(
            "AUDIO_TOO_LONG",
            f"Thời lượng bài hát ({round(duration_sec, 1)}s) vượt quá giới hạn tối đa cho phép ({max_duration_sec}s)"
        )

    return destination_path, duration_sec
