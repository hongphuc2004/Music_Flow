"""
config.py — Configuration for MusicFlow AI Alignment Worker
All settings read from environment variables with safe production defaults.
"""

import os

# Database Connection
raw_mongo_uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://127.0.0.1:27017/musicflow_db"
if not os.path.exists("/.dockerenv") and not os.getenv("RUNNING_IN_DOCKER"):
    if "mongodb://mongo:" in raw_mongo_uri:
        raw_mongo_uri = raw_mongo_uri.replace("mongodb://mongo:", "mongodb://127.0.0.1:")
MONGODB_URI = raw_mongo_uri
DATABASE_NAME = os.getenv("DATABASE_NAME", "musicflow_db")

# Worker Lifecycle & Polling
POLL_INTERVAL_SEC = float(os.getenv("POLL_INTERVAL_SEC", "3.0"))
JOB_EXECUTION_TIMEOUT_SEC = int(os.getenv("JOB_EXECUTION_TIMEOUT_SEC", "300"))
STALE_LOCK_THRESHOLD_SEC = int(os.getenv("STALE_LOCK_THRESHOLD_SEC", "600"))
HEARTBEAT_INTERVAL_SEC = int(os.getenv("HEARTBEAT_INTERVAL_SEC", "30"))
MAX_JOB_ATTEMPTS = int(os.getenv("MAX_JOB_ATTEMPTS", "2"))

# Hardware & Memory Safety
try:
    import torch
    has_cuda = torch.cuda.is_available()
except ImportError:
    has_cuda = False

ALLOW_CPU_FALLBACK = os.getenv("ALLOW_CPU_FALLBACK", "true").lower() in ("true", "1", "yes")
WORKER_DEVICE = os.getenv("WORKER_DEVICE", "cuda" if has_cuda else "cpu")

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
AUDIO_HIGH_PASS_HZ = float(os.getenv("AUDIO_HIGH_PASS_HZ", "80.0"))
AUDIO_NORMALIZE_ENABLED = os.getenv("AUDIO_NORMALIZE_ENABLED", "true").lower() in ("true", "1", "yes")

# Long Audio Chunking Settings
WINDOW_SECONDS = int(os.getenv("WINDOW_SECONDS", "60"))
WINDOW_OVERLAP_SECONDS = int(os.getenv("WINDOW_OVERLAP_SECONDS", "3"))

# Fallback Policy
ALLOW_HEURISTIC_FALLBACK = os.getenv("ALLOW_HEURISTIC_FALLBACK", "false").lower() in ("true", "1", "yes")

# Auto-Transcription Capabilities
TRANSCRIPTION_PROVIDER = os.getenv("TRANSCRIPTION_PROVIDER", "whisper")
TRANSCRIPTION_MODEL = os.getenv("TRANSCRIPTION_MODEL", "whisper-base")
TRANSCRIPTION_VERSION = os.getenv("TRANSCRIPTION_VERSION", "1.0.0")
ALLOW_EXTERNAL_TRANSCRIPTION = os.getenv("ALLOW_EXTERNAL_TRANSCRIPTION", "false").lower() in ("true", "1", "yes")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
