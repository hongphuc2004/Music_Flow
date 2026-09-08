"""
modal_app.py — Modal Serverless Webhook for MusicFlow AI Lyrics Alignment
Runs on-demand with 5GB RAM and 2 Dedicated CPUs.
Scales to ZERO when idle (100% $0 cost when not in use).
"""

import os
import sys
import shutil
import tempfile
import time
import modal  # type: ignore

# Define Modal App
app = modal.App("musicflow-lyrics-sync")

# Build lightweight Debian container image with PyTorch CPU & Audio libraries
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git", "curl")
    .pip_install(
        "torch>=2.1.0",
        "torchaudio>=2.1.0",
        "transformers>=4.36.0",
        "soundfile>=0.12.1",
        "scipy>=1.11.0",
        "numpy>=1.24.0",
        "requests>=2.31.0",
        "pydantic>=2.5.0",
        "accelerate>=0.26.0",
        "fastapi>=0.109.0",
        extra_index_url="https://download.pytorch.org/whl/cpu",
    )
    .add_local_dir(
        os.path.join(os.path.dirname(__file__), "pipeline"),
        remote_path="/root/pipeline",
    )
    .add_local_file(
        os.path.join(os.path.dirname(__file__), "config.py"),
        remote_path="/root/config.py",
    )
)


def execute_alignment_pipeline(audio_url: str, plain_lyrics: str):
    """
    Executes full continuous Wav2Vec2 CTC forced alignment for an audio URL and plain lyrics.
    """
    sys.path.insert(0, "/root")
    import config
    from pipeline.downloader import download_audio_from_url
    from pipeline.preprocessor import convert_to_16k_mono
    from pipeline.aligner import align_lyrics
    from pipeline.postprocessor import apply_energy_tail_extension, compile_line_and_word_lyrics
    from pipeline.onset_snapper import snap_word_onsets
    from pipeline.validator import validate_alignment_quality

    temp_dir = tempfile.mkdtemp(prefix="modal_align_")
    try:
        t_start = time.time()
        print(f"[Modal] Downloading audio from {audio_url}...", flush=True)
        raw_audio_path, duration_sec = download_audio_from_url(audio_url, temp_dir)

        print(f"[Modal] Converting to 16kHz mono WAV ({duration_sec:.1f}s)...", flush=True)
        wav_16k_path = os.path.join(temp_dir, "input_16k.wav")
        convert_to_16k_mono(
            raw_audio_path,
            wav_16k_path,
            high_pass_enabled=config.AUDIO_HIGH_PASS_ENABLED,
            high_pass_hz=config.AUDIO_HIGH_PASS_HZ,
            normalize_enabled=config.AUDIO_NORMALIZE_ENABLED,
        )

        print(f"[Modal] Running global continuous Wav2Vec2 CTC alignment ({config.CTC_MODEL_NAME})...", flush=True)
        raw_words, _ = align_lyrics(
            wav_16k_path,
            plain_lyrics,
            model_name=config.CTC_MODEL_NAME,
            device="cpu",
        )

        # Onset Snapping
        try:
            raw_words = snap_word_onsets(wav_16k_path, raw_words)
        except Exception as e:
            print(f"[Modal] Onset snapping skipped: {e}", flush=True)

        # Post-Processing
        print(f"[Modal] Applying energy tail extension & compiling LRC...", flush=True)
        processed_words = apply_energy_tail_extension(
            wav_16k_path,
            raw_words,
            duration_sec,
            max_tail_sec=config.MAX_TAIL_EXTENSION_SEC,
            energy_threshold_db=config.ENERGY_TAIL_THRESHOLD_DB,
        )

        synced_lines, lrc_data = compile_line_and_word_lyrics(processed_words, plain_lyrics)
        quality_status, quality_notes = validate_alignment_quality(
            processed_words,
            plain_lyrics,
            duration_sec,
        )

        total_elapsed = round(time.time() - t_start, 2)
        print(f"[Modal] ✅ Alignment completed in {total_elapsed}s! Quality: {quality_status}", flush=True)

        return {
            "success": True,
            "provider": "modal",
            "duration": duration_sec,
            "elapsedSeconds": total_elapsed,
            "qualityStatus": quality_status,
            "qualityNotes": quality_notes,
            "syncedLines": synced_lines,
            "lrcData": lrc_data,
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.function(
    image=image,
    memory=5120,          # 5GB RAM
    cpu=2.0,              # 2 vCPUs
    timeout=300,          # 5 minutes max per request
    scaledown_window=10,  # Scale down to 0 after 10s of inactivity ($0 idle cost)
)
@modal.fastapi_endpoint(method="POST")
def align(data: dict):
    """
    On-Demand Serverless Webhook:
    Receives { "audioUrl": "...", "plainLyrics": "..." }
    Returns synchronized LRC and word-level timestamps.
    """
    audio_url = data.get("audioUrl") or data.get("audio_url")
    plain_lyrics = data.get("plainLyrics") or data.get("plain_lyrics")

    if not audio_url or not plain_lyrics:
        return {
            "success": False,
            "error": "Thiếu audioUrl hoặc plainLyrics trong payload",
        }

    try:
        result = execute_alignment_pipeline(audio_url, plain_lyrics)
        return result
    except Exception as e:
        print(f"[Modal] Alignment error: {e}", flush=True)
        return {
            "success": False,
            "error": str(e),
        }
