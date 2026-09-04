# Dockerfile for MusicFlow AI Alignment Worker
# Optimized for Production (Render / Cloud / Docker CPU)
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV TEMP_STORAGE_DIR=/tmp/musicflow_alignment
ENV WORKER_DEVICE=cpu
ENV ALLOW_CPU_FALLBACK=true
ENV PORT=10000

EXPOSE 10000

# Install system dependencies (ffmpeg for audio decoding, libsndfile for librosa/soundfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CPU first (drastically reduces image size from ~5GB to ~800MB and speeds up build on Render)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-compile & export quantized TorchScript int8 Wav2Vec2 model into image during build
# This bakes the compact 116MB int8 model directly into the filesystem, completely eliminating
# runtime HuggingFace downloads and memory spikes on Render 512MB RAM free tier.
COPY export_quantized_model.py .
RUN python3 export_quantized_model.py

# Copy application source code
COPY . .

# Create temporary working directory for audio processing
RUN mkdir -p /tmp/musicflow_alignment

# Run worker process
CMD ["python3", "main.py"]
