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
    """
    if audio_data.ndim > 1:
        audio_data = np.mean(audio_data, axis=1)

    # 1. DC offset removal
    audio_data = audio_data - np.mean(audio_data)

    # 2. Butterworth High-Pass Filter (4th order)
    if high_pass_enabled and high_pass_hz > 0:
        try:
            sos = signal.butter(4, high_pass_hz, btype='highpass', fs=sr, output='sos')
            audio_data = signal.sosfiltfilt(sos, audio_data)
        except Exception:
            pass

    # 3. Peak Normalization (prevent clipping while maintaining speech dynamics)
    if normalize_enabled:
        max_val = np.max(np.abs(audio_data)) + 1e-12
        if max_val > 0.01:
            audio_data = (audio_data / max_val) * 0.95

    return audio_data.astype(np.float32)

def convert_to_16k_mono(
    input_audio_path: str,
    output_wav_path: str,
    high_pass_enabled: bool = True,
    high_pass_hz: float = 80.0,
    normalize_enabled: bool = True
) -> str:
    """
    Converts any input audio format (MP3, AAC, FLAC, OGG, WAV) to 16kHz Mono 16-bit PCM WAV.
    Applies DC offset removal, high pass filtering, and waveform normalization.
    """
    out_dir = os.path.dirname(output_wav_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    data = None
    sr = 16000

    # 1. Try ffmpeg subprocess
    try:
        temp_raw = output_wav_path + ".raw.wav"
        cmd = [
            "ffmpeg", "-y",
            "-i", input_audio_path,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            temp_raw
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        if os.path.exists(temp_raw) and os.path.getsize(temp_raw) > 0:
            data, sr = sf.read(temp_raw)
            if os.path.exists(temp_raw):
                os.remove(temp_raw)
    except Exception:
        pass

    # 2. Fallback to librosa / soundfile
    if data is None:
        try:
            import librosa
            data, sr = librosa.load(input_audio_path, sr=16000, mono=True)
        except Exception as e:
            raise RuntimeError(f"Không thể chuyển đổi định dạng âm thanh 16kHz mono: {str(e)}")

    # 3. Apply audio filtering and normalization
    filtered_data = apply_audio_filters(
        data,
        sr=16000,
        high_pass_enabled=high_pass_enabled,
        high_pass_hz=high_pass_hz,
        normalize_enabled=normalize_enabled
    )

    # 4. Save to output path as standard 16-bit PCM WAV
    sf.write(output_wav_path, filtered_data, 16000, subtype="PCM_16")
    return output_wav_path
