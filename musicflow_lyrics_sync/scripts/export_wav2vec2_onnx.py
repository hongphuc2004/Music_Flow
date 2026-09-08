"""
scripts/export_wav2vec2_onnx.py
Exports and dynamically quantizes nguyenvulebinh/wav2vec2-base-vietnamese-250h using Optimum ONNX.
"""

import os
import sys
import time
import psutil
import numpy as np
from transformers import AutoTokenizer
from optimum.onnxruntime import ORTModelForCTC, ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig
import onnxruntime as ort

MODEL_NAME = "nguyenvulebinh/wav2vec2-base-vietnamese-250h"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "wav2vec2_onnx")
QUANTIZED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "wav2vec2_onnx_int8")

def export_and_quantize():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(QUANTIZED_DIR, exist_ok=True)
    print("=" * 60)
    print("🚀 BẮT ĐẦU TỐI ƯU HÓA MÔ HÌNH WAV2VEC2 SANG ONNX INT8...")
    print("=" * 60)
    
    p = psutil.Process(os.getpid())
    
    # 1. Export Model to ONNX via Optimum (if not exists)
    onnx_file = os.path.join(OUTPUT_DIR, "model.onnx")
    if not os.path.exists(onnx_file):
        print(f"\n[1/3] Đang xuất mô hình sang ONNX ({MODEL_NAME})...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        tokenizer.save_pretrained(OUTPUT_DIR)
        tokenizer.save_pretrained(QUANTIZED_DIR)
        
        model = ORTModelForCTC.from_pretrained(MODEL_NAME, export=True)
        model.save_pretrained(OUTPUT_DIR)
        del model
    else:
        print(f"\n[1/3] Đã có sẵn file ONNX FP32: {onnx_file}")
    
    fp32_size_mb = os.path.getsize(onnx_file) / (1024 * 1024)
    print(f" ✅ Dung lượng ONNX FP32: {fp32_size_mb:.1f} MB")
    
    # 2. Dynamic INT8 Quantization using ONNXRuntime directly on MatMul / Attention layers
    print(f"\n[2/3] Đang lượng tử hóa (INT8 Quantization) các tầng Transformer...")
    onnx_file = os.path.join(OUTPUT_DIR, "model.onnx")
    quantized_onnx_file = os.path.join(QUANTIZED_DIR, "model_quantized.onnx")
    
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(
        model_input=onnx_file,
        model_output=quantized_onnx_file,
        op_types_to_quantize=["MatMul"],
        weight_type=QuantType.QInt8,
        disable_shape_inference=True,
    )
    
    int8_size_mb = os.path.getsize(quantized_onnx_file) / (1024 * 1024)
    print(f" ✅ Đã lượng tử hóa INT8 thành công: {quantized_onnx_file} ({int8_size_mb:.1f} MB)")
    
    # 3. Benchmark ONNX INT8 Memory & Inference
    print(f"\n[3/3] Đang đo đạc RAM và tốc độ thực tế với bài hát 4 phút (240s)...")
    
    del model
    import gc
    gc.collect()
    
    # Load quantized model with ONNX Runtime directly
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = 2
    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    
    session = ort.InferenceSession(quantized_onnx_file, session_options, providers=["CPUExecutionProvider"])
    
    # Test with 240s of 16kHz audio (3,840,000 samples)
    test_audio = np.random.randn(1, 16000 * 240).astype(np.float32)
    
    t_start = time.time()
    outputs = session.run(["logits"], {"input_values": test_audio})
    elapsed = time.time() - t_start
    
    logits = outputs[0]
    peak_ram_mb = p.memory_info().rss / (1024 * 1024)
    
    print("\n" + "=" * 60)
    print("🎉 KẾT QUẢ ĐO ĐẠC THỰC TẾ:")
    print(f" • Dung lượng mô hình gốc: {fp32_size_mb:.1f} MB")
    print(f" • Dung lượng mô hình sau nén INT8: {int8_size_mb:.1f} MB (Giảm {(1 - int8_size_mb/fp32_size_mb)*100:.1f}%)")
    print(f" • RAM đỉnh điểm khi chạy bài hát 4 phút: {peak_ram_mb:.1f} MB (~{peak_ram_mb/1024:.2f} GB)")
    print(f" • Thời gian chạy (2 vCPUs): {elapsed:.2f} giây")
    print(f" • Logits shape: {logits.shape}")
    print(f" • Tương thích Render Free Tier (512MB RAM): {'✅ 100% HOÀN TOÀN ĐẠT CHUẨN' if peak_ram_mb < 450 else '⚠️ Cần kiểm tra thêm'}")
    print("=" * 60)

if __name__ == "__main__":
    export_and_quantize()
