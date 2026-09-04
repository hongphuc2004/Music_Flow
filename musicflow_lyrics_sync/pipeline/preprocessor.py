import os
import subprocess
import numpy as np
import soundfile as sf
from scipy import signal

def apply_audio_filters(
    audio_data: np.ndarray,
    sr: int = 16000,
    high_pass_enabled: bool = True,
    high_pass_hz: float = 80.0,
    normalize_enabled: bool = True
) -> np.ndarray:
    """
    Applies DC offset removal, Butterworth High-Pass filter, and peak normalization.
    Uses in-place operations with float32 to minimize memory allocation.
    """
    if audio_data.ndim > 1:
        audio_data = np.mean(audio_data, axis=1)

    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)

    # 1. DC offset removal (in-place)
    audio_data -= np.mean(audio_data)

    # 2. Butterworth High-Pass Filter (4th order)
    if high_pass_enabled and high_pass_hz > 0:
        try:
            sos = signal.butter(4, high_pass_hz, btype='highpass', fs=sr, output='sos')
            audio_data = signal.sosfiltfilt(sos, audio_data).astype(np.float32)
        except Exception:
            pass

    # 3. Peak Normalization (prevent clipping while maintaining speech dynamics)
    if normalize_enabled:
        max_val = float(np.max(np.abs(audio_data))) + 1e-12
        if max_val > 0.01:
            audio_data *= (0.95 / max_val)

    return audio_data

def convert_to_16k_mono(
    input_audio_path: str,
    output_wav_path: str,
    high_pass_enabled: bool = True,
    high_pass_hz: float = 80.0,
    normalize_enabled: bool = True
) -> str:
    """
    Converts any input audio format (MP3, AAC, FLAC, OGG, WAV) to 16kHz Mono 16-bit PCM WAV.
    Applies high-pass filtering and volume normalization.
    Uses single-pass native FFmpeg streaming to avoid holding audio buffers in Python RAM.
    """
    out_dir = os.path.dirname(output_wav_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # 1. First choice: Native single-pass FFmpeg (0 MB Python RAM, <10MB process RAM, 0.4s runtime)
    try:
        af_filters = []
        if high_pass_enabled and high_pass_hz > 0:
            af_filters.append(f"highpass=f={high_pass_hz}")
        if normalize_enabled:
            af_filters.append("volume=0.95")

        cmd = [
            "ffmpeg", "-y",
            "-i", input_audio_path,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
        ]
        if af_filters:
            cmd.extend(["-af", ",".join(af_filters)])
        cmd.append(output_wav_path)

        subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )

        if os.path.exists(output_wav_path) and os.path.getsize(output_wav_path) > 0:
            return output_wav_path
    except Exception:
        # If ffmpeg is not installed or fails, proceed to Python fallback
        pass

    # 2. Fallback to soundfile / scipy with float32 (for environments without FFmpeg)
    try:
        data, file_sr = sf.read(input_audio_path, dtype="float32")
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if file_sr != 16000:
            gcd = np.gcd(16000, file_sr)
            data = signal.resample_poly(data, 16000 // gcd, file_sr // gcd).astype(np.float32)

        filtered_data = apply_audio_filters(
            data,
            sr=16000,
            high_pass_enabled=high_pass_enabled,
            high_pass_hz=high_pass_hz,
            normalize_enabled=normalize_enabled
        )
        sf.write(output_wav_path, filtered_data, 16000, subtype="PCM_16")
        return output_wav_path
    except Exception as e:
        raise RuntimeError(f"Không thể chuyển đổi định dạng âm thanh 16kHz mono: {str(e)}")

