"""
modal_app.py — Modal Cloud Deployment for MusicFlow AI Lyrics Alignment Worker
Runs Wav2Vec2 CTC Forced Alignment with 5GB RAM and 2 Dedicated CPUs.
"""

import os
import sys
import modal

# Define Modal App
app = modal.App("musicflow-lyrics-sync")

# Build lightweight Debian container image with PyTorch CPU & Audio libraries
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .pip_install(
        "torch>=2.1.0",
        "torchaudio>=2.1.0",
        "transformers>=4.36.0",
        "pymongo>=4.6.0",
        "soundfile>=0.12.1",
        "scipy>=1.11.0",
        "numpy>=1.24.0",
        "requests>=2.31.0",
        "pydantic>=2.5.0",
        "accelerate>=0.26.0",
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
    .add_local_file(
        os.path.join(os.path.dirname(__file__), "main.py"),
        remote_path="/root/main.py",
    )
)

# Secret containing MONGODB_URI
secret = modal.Secret.from_name("musicflow-mongo")


@app.function(
    image=image,
    memory=5120,           # 5GB RAM (Dư dả chạy Wav2Vec2 CTC không bao giờ lo OOM)
    cpu=2.0,               # 2 Dedicated vCPUs
    timeout=86400,         # 24 hours continuous worker execution
    secrets=[secret],
)
def run_worker():
    """Starts the MusicFlow Alignment Worker polling loop inside Modal."""
    sys.path.insert(0, "/root")
    import main
    
    print("[ModalWorker] Starting MusicFlow AI Alignment Worker on Modal Cloud (5GB RAM)...", flush=True)
    worker = main.AlignmentWorker()
    worker.run()


@app.local_entrypoint()
def main_entry():
    """Allows running directly via 'modal run modal_app.py' to test instantly."""
    print("Launching AI Lyrics Worker on Modal (5GB RAM)...")
    run_worker.remote()  # type: ignore
