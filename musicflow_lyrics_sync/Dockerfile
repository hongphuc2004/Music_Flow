# Dockerfile for MusicFlow AI Lyrics Alignment Worker
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV TEMP_STORAGE_DIR=/tmp/musicflow_alignment
ENV WORKER_DEVICE=cpu
ENV ALLOW_CPU_FALLBACK=true
ENV MALLOC_ARENA_MAX=1
ENV ORT_NUM_THREADS=1
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1

# Install system dependencies (ffmpeg for audio decoding, libsndfile for librosa/soundfile, git-lfs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    git-lfs \
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

# Ensure Git LFS model is pulled if model_quantized.onnx is just an LFS pointer
RUN git lfs install --skip-repo || true && \
    if [ -f "models/wav2vec2_onnx_int8/model_quantized.onnx" ] && [ $(stat -c%s "models/wav2vec2_onnx_int8/model_quantized.onnx") -lt 1000000 ]; then \
        echo "Detected Git LFS pointer for ONNX INT8 model. Pulling binary asset..." && \
        (git lfs pull || true); \
    fi

# Create temporary working directory with full read/write permissions
RUN mkdir -p /tmp/musicflow_alignment && chmod -R 777 /tmp/musicflow_alignment /app

# Run background alignment worker
CMD ["python3", "main.py"]
