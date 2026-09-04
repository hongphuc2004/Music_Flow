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

# Pre-cache Vietnamese Wav2Vec2 model into image during build to eliminate runtime download latency and memory spikes
RUN python3 -c "from transformers import AutoProcessor, Wav2Vec2ForCTC; \
    AutoProcessor.from_pretrained('nguyenvulebinh/wav2vec2-base-vietnamese-250h'); \
    Wav2Vec2ForCTC.from_pretrained('nguyenvulebinh/wav2vec2-base-vietnamese-250h', low_cpu_mem_usage=True)"

# Copy application source code
COPY . .

# Create temporary working directory for audio processing
RUN mkdir -p /tmp/musicflow_alignment

# Run worker process
CMD ["python3", "main.py"]
