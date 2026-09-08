# Dockerfile for MusicFlow AI Lyrics Alignment Worker
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV TEMP_STORAGE_DIR=/tmp/musicflow_alignment
ENV WORKER_DEVICE=cpu
ENV ALLOW_CPU_FALLBACK=true

# Install system dependencies (ffmpeg for audio decoding, libsndfile for librosa/soundfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CPU first (drastically reduces image size from ~5GB to ~800MB and speeds up build)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Create temporary working directory with full read/write permissions
RUN mkdir -p /tmp/musicflow_alignment && chmod -R 777 /tmp/musicflow_alignment /app

# Run background alignment worker
CMD ["python3", "main.py"]
