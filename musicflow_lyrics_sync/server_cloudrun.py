"""
server_cloudrun.py — FastAPI Webhook Server for MusicFlow AI Lyrics Alignment.
Exposes HTTP endpoints:
  - GET  /health -> Healthcheck
  - POST /align  -> Continuous Wav2Vec2 CTC Lyrics Alignment
"""

import os
import sys
import shutil
import tempfile
import time
from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel, Field  # type: ignore

# Ensure current directory is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

import config
from pipeline.downloader import download_audio_from_url
from pipeline.preprocessor import convert_to_16k_mono
from pipeline.aligner import align_lyrics
from pipeline.postprocessor import apply_energy_tail_extension, compile_line_and_word_lyrics
from pipeline.onset_snapper import snap_word_onsets
from pipeline.validator import validate_alignment_quality

app = FastAPI(title="MusicFlow AI Lyrics Alignment Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AlignmentRequest(BaseModel):
    audioUrl: str = Field(..., description="Public audio stream or Cloudinary URL")
    plainLyrics: str = Field(..., description="Plain lyrics text")


@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "musicflow-lyrics-sync",
        "device": config.WORKER_DEVICE,
    }


@app.post("/align")
def align_lyrics_endpoint(req: AlignmentRequest):
    if not req.audioUrl or not req.plainLyrics.strip():
        raise HTTPException(status_code=400, detail="Thiếu audioUrl hoặc plainLyrics hợp lệ")

    temp_dir = tempfile.mkdtemp(prefix="align_")
    t_start = time.time()
    
    print("\n" + "=" * 65, flush=True)
    print("🎵 [MusicFlow AI Aligner] Nhận yêu cầu tạo nhịp lời bài hát mới!", flush=True)
    print(f" • Lời bài hát: {len(req.plainLyrics.strip().splitlines())} dòng, {len(req.plainLyrics.strip())} ký tự", flush=True)
    print(f" • Audio Source: {req.audioUrl[:80]}...", flush=True)
    print("=" * 65, flush=True)

    try:
        # 1. Download Audio
        print("[1/5] 📥 Đang tải và kiểm tra tệp âm thanh...", flush=True)
        raw_audio_path, duration_sec = download_audio_from_url(req.audioUrl, temp_dir)
        print(f"      ✅ Tải thành công! Thời lượng: {duration_sec:.1f}s ({duration_sec/60:.1f} phút)", flush=True)

        # 2. Preprocess 16kHz mono with Zero-Phase HighPass & Peak Normalization
        print(f"[2/5] 🎚️ Đang chuẩn hóa âm thanh (16kHz Mono, HighPass {config.AUDIO_HIGH_PASS_HZ}Hz, Peak Norm)...", flush=True)
        wav_16k_path = os.path.join(temp_dir, "input_16k.wav")
        convert_to_16k_mono(
            raw_audio_path,
            wav_16k_path,
            high_pass_enabled=config.AUDIO_HIGH_PASS_ENABLED,
            high_pass_hz=config.AUDIO_HIGH_PASS_HZ,
            normalize_enabled=config.AUDIO_NORMALIZE_ENABLED,
        )
        print("      ✅ Chuẩn hóa âm thanh hoàn tất!", flush=True)

        # 3. Global Single-Pass Wav2Vec2 CTC Alignment
        print(f"[3/5] 🧠 Đang chạy mô hình Wav2Vec2 CTC + Trellis DP + Viterbi (ONNX INT8)...", flush=True)
        t_align = time.time()
        raw_words, _ = align_lyrics(
            wav_16k_path,
            req.plainLyrics,
            model_name=config.CTC_MODEL_NAME,
            device="cpu",
        )
        align_elapsed = time.time() - t_align
        print(f"      ✅ Bắt nhịp âm học hoàn tất trong {align_elapsed:.2f}s! ({len(raw_words)} từ)", flush=True)

        # 4. Onset Snapping
        print("[4/5] ⚡ Đang tinh chỉnh điểm onset & năng lượng đuôi âm thanh (Energy Tail)...", flush=True)
        try:
            raw_words = snap_word_onsets(wav_16k_path, raw_words)
        except Exception:
            pass

        # 5. Energy Tail Extension & LRC compilation
        processed_words = apply_energy_tail_extension(
            wav_16k_path,
            raw_words,
            duration_sec,
            max_tail_sec=config.MAX_TAIL_EXTENSION_SEC,
            energy_threshold_db=config.ENERGY_TAIL_THRESHOLD_DB,
        )

        synced_lines, lrc_data = compile_line_and_word_lyrics(processed_words, req.plainLyrics)
        quality_status, quality_notes = validate_alignment_quality(
            synced_lines,
            req.plainLyrics,
            duration_sec,
        )

        total_elapsed = round(time.time() - t_start, 2)
        print(f"[5/5] 🎉 ĐÃ HOÀN TẤT CĂN NHỊP TOÀN BỘ BÀI HÁT!", flush=True)
        print(f" • Tổng thời gian: {total_elapsed}s", flush=True)
        print(f" • Số câu đồng bộ: {len(synced_lines)} dòng", flush=True)
        print(f" • Chất lượng đánh giá: {quality_status}", flush=True)
        print("=" * 65 + "\n", flush=True)

        return {
            "success": True,
            "provider": "local_cpu",
            "duration": duration_sec,
            "elapsedSeconds": total_elapsed,
            "qualityStatus": quality_status,
            "qualityNotes": quality_notes,
            "syncedLines": synced_lines,
            "lrcData": lrc_data,
        }
    except Exception as e:
        print(f"\n❌ [ERROR] Lỗi căn nhịp: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi căn nhịp: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn  # type: ignore
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("server_cloudrun:app", host="0.0.0.0", port=port, reload=True)
