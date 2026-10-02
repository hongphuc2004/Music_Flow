"""
config.py — Configuration for MusicFlow AI Alignment Worker
All settings read from environment variables with safe production defaults.
"""

import os

# Try loading environment variables from .env files if not already set
_current_dir = os.path.dirname(os.path.abspath(__file__))
_possible_env_paths = [
    os.path.join(_current_dir, ".env"),
    os.path.join(_current_dir, "..", "musicflow_backend", ".env.dev"),
    os.path.join(_current_dir, "..", "musicflow_backend", ".env"),
]
for _env_path in _possible_env_paths:
    if os.path.exists(_env_path):
        try:
            with open(_env_path, "r", encoding="utf-8") as _f:
                for _raw_line in _f:
                    _line = _raw_line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        _k = _k.strip()
                        _v = _v.strip().strip("'\"")
                        if _k and _k not in os.environ:
                            os.environ[_k] = _v
        except Exception:
            pass

# Gemini AI Settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(",") if m.strip()
]

# Database Connection
raw_mongo_uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://127.0.0.1:27017/musicflow_db"
if not os.path.exists("/.dockerenv") and not os.getenv("RUNNING_IN_DOCKER"):
    if "mongodb://mongo:" in raw_mongo_uri:
        raw_mongo_uri = raw_mongo_uri.replace("mongodb://mongo:", "mongodb://127.0.0.1:")
MONGODB_URI = raw_mongo_uri
DATABASE_NAME = os.getenv("DATABASE_NAME", "musicflow_db")

# Worker Lifecycle & Polling
POLL_INTERVAL_SEC = float(os.getenv("POLL_INTERVAL_SEC", "3.0"))
JOB_EXECUTION_TIMEOUT_SEC = int(os.getenv("JOB_EXECUTION_TIMEOUT_SEC", "120"))
STALE_LOCK_THRESHOLD_SEC = int(os.getenv("STALE_LOCK_THRESHOLD_SEC", "60"))
HEARTBEAT_INTERVAL_SEC = int(os.getenv("HEARTBEAT_INTERVAL_SEC", "15"))
MAX_JOB_ATTEMPTS = int(os.getenv("MAX_JOB_ATTEMPTS", "2"))

# Hardware & Memory Safety
ALLOW_CPU_FALLBACK = os.getenv("ALLOW_CPU_FALLBACK", "true").lower() in ("true", "1", "yes")
_env_device = os.getenv("WORKER_DEVICE")
if _env_device:
    WORKER_DEVICE = _env_device.lower()
else:
    WORKER_DEVICE = "cpu"

# Audio & Post-processing Constraints
MAX_SONG_DURATION_SEC = int(os.getenv("MAX_SONG_DURATION_SEC", "420")) # 7 minutes
MAX_TAIL_EXTENSION_SEC = float(os.getenv("MAX_TAIL_EXTENSION_SEC", "1.2"))
ENERGY_TAIL_THRESHOLD_DB = float(os.getenv("ENERGY_TAIL_THRESHOLD_DB", "-35.0"))
TEMP_STORAGE_DIR = os.getenv("TEMP_STORAGE_DIR", "/tmp/musicflow_alignment")

# Models & Pipeline Identifiers
ENABLE_VOCAL_SEPARATION = os.getenv("ENABLE_VOCAL_SEPARATION", "false").lower() in ("true", "1", "yes")
SEPARATOR_MODEL = os.getenv("SEPARATOR_MODEL", "htdemucs" if ENABLE_VOCAL_SEPARATION else "none")
ALIGNMENT_MODEL = os.getenv("ALIGNMENT_MODEL", "nguyenvulebinh/wav2vec2-base-vietnamese-250h")
CTC_MODEL_NAME = os.getenv("CTC_MODEL_NAME", ALIGNMENT_MODEL)
PIPELINE_VERSION = os.getenv("PIPELINE_VERSION", "3.0.0")
POSTPROCESS_VERSION = os.getenv("POSTPROCESS_VERSION", "3.0.0")

# Preprocessing & Filter Settings
AUDIO_HIGH_PASS_ENABLED = os.getenv("AUDIO_HIGH_PASS_ENABLED", "true").lower() in ("true", "1", "yes")
AUDIO_HIGH_PASS_HZ = float(os.getenv("AUDIO_HIGH_PASS_HZ", "100.0"))
AUDIO_NORMALIZE_ENABLED = os.getenv("AUDIO_NORMALIZE_ENABLED", "true").lower() in ("true", "1", "yes")

# Fallback Policy
ALLOW_HEURISTIC_FALLBACK = os.getenv("ALLOW_HEURISTIC_FALLBACK", "false").lower() in ("true", "1", "yes")

# Auto-Transcription Capabilities (Gemini 2.5 Flash / Faster-Whisper CPU INT8)
TRANSCRIPTION_PROVIDER = os.getenv("TRANSCRIPTION_PROVIDER", "gemini-flash" if GEMINI_API_KEY else "faster-whisper")
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "medium") # base | small | medium | large-v3
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8") # int8 for CPU, float16 for GPU
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "vi")
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
WHISPER_WORD_TIMESTAMPS = os.getenv("WHISPER_WORD_TIMESTAMPS", "true").lower() in ("true", "1", "yes")
WHISPER_VAD_FILTER = os.getenv("WHISPER_VAD_FILTER", "true").lower() in ("true", "1", "yes")
WHISPER_VAD_MIN_SILENCE_MS = int(os.getenv("WHISPER_VAD_MIN_SILENCE_MS", "400"))
WHISPER_VAD_SPEECH_PAD_MS = int(os.getenv("WHISPER_VAD_SPEECH_PAD_MS", "300"))
WHISPER_REPETITION_PENALTY = float(os.getenv("WHISPER_REPETITION_PENALTY", "1.15"))
WHISPER_HALLUCINATION_SILENCE_THRESHOLD = float(os.getenv("WHISPER_HALLUCINATION_SILENCE_THRESHOLD", "2.0"))
WHISPER_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "4"))
TRANSCRIPTION_MODEL = WHISPER_MODEL_SIZE
TRANSCRIPTION_VERSION = os.getenv("TRANSCRIPTION_VERSION", "1.0.0")
