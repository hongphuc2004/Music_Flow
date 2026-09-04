"""
export_quantized_model.py
Pre-quantizes and exports Wav2Vec2 Vietnamese model to TorchScript during Docker build.
Ensures zero RAM spikes and instant startup (<200ms) on Render 512MB RAM free tier.
"""
import os
import torch
from transformers import AutoProcessor, Wav2Vec2ForCTC

MODEL_NAME = os.getenv("ALIGNMENT_MODEL", "nguyenvulebinh/wav2vec2-base-vietnamese-250h")
CACHE_DIR = os.getenv("MODEL_CACHE_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_cache"))

def export():
    os.makedirs(CACHE_DIR, exist_ok=True)
    processor_dir = os.path.join(CACHE_DIR, "processor")
    model_path = os.path.join(CACHE_DIR, "wav2vec2_int8.pt")

    print(f"[Build-Export] Exporting processor for {MODEL_NAME}...")
    processor = AutoProcessor.from_pretrained(MODEL_NAME)
    processor.save_pretrained(processor_dir)

    print(f"[Build-Export] Loading float32 weights for {MODEL_NAME}...")
    model = Wav2Vec2ForCTC.from_pretrained(MODEL_NAME, low_cpu_mem_usage=True)
    model.eval()

    print("[Build-Export] Applying dynamic int8 quantization...")
    q_model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)

    print("[Build-Export] Tracing model to TorchScript JIT...")
    dummy_input = torch.randn(1, 16000 * 2)
    traced_model = torch.jit.trace(q_model, dummy_input, strict=False)

    print(f"[Build-Export] Saving TorchScript model to {model_path}...")
    torch.jit.save(traced_model, model_path)

    size_mb = os.path.getsize(model_path) / (1024 * 1024)
    print(f"✅ [Build-Export] Model successfully exported to {model_path}! Size: {size_mb:.1f} MB")

if __name__ == "__main__":
    export()
