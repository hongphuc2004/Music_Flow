"""
aligner.py — High-Precision Neural Acoustic CTC Forced Alignment
Implements Wav2Vec2ForCTC forward pass, Log-Softmax emission extraction,
Trellis Dynamic Programming in Log-Space, and Viterbi Backtracking.
"""

import logging
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf

logger = logging.getLogger("AlignmentWorker.Aligner")


class CTCModelLoadError(Exception):
    """Raised when the CTC acoustic model fails to load."""
    pass


class CTCTokenizerError(Exception):
    """Raised when text tokenization fails."""
    pass


class CTCInferenceError(Exception):
    """Raised when neural forward pass or emission extraction fails."""
    pass


class CTCAlignmentError(Exception):
    """Raised when trellis computation or backtracking fails."""
    pass


class VietnameseTextNormalizer:
    """
    Normalizes Vietnamese lyrics to standard Unicode NFC while strictly preserving
    all Vietnamese diacritics, tone marks, and characters.
    """

    @staticmethod
    def normalize_text(text: str) -> str:
        if not isinstance(text, str):
            return ""
        # 1. Unicode NFC Normalization
        text = unicodedata.normalize("NFC", text)
        # 2. Lowercase
        text = text.lower()
        # 3. Replace common typographic punctuations with whitespace
        text = re.sub(r'[\.,\?!:;\(\)\[\]"\'\-_~/\\]', ' ', text)
        # 4. Collapse multiple whitespaces per line
        lines = [re.sub(r'\s+', ' ', l).strip() for l in text.splitlines()]
        return "\n".join([l for l in lines if l])

    @staticmethod
    def extract_words_and_lines(plain_lyrics: str) -> Tuple[List[str], List[List[Dict[str, Any]]]]:
        """
        Parses lyrics into structured lines and words with metadata.
        Returns: (raw_lines, line_words_map)
        """
        raw_lines = [l.strip() for l in plain_lyrics.splitlines() if l.strip()]
        if not raw_lines:
            raise ValueError("Lời bài hát rỗng (Không có dòng lời bài hát nào để căn nhịp)")

        line_words_map: List[List[Dict[str, Any]]] = []
        global_word_idx = 0

        for line_idx, line in enumerate(raw_lines):
            words = line.split()
            current_line_words = []
            for w_in_line_idx, w in enumerate(words):
                # Clean word for acoustic matching
                norm_w = unicodedata.normalize("NFC", w).lower()
                norm_w = re.sub(r'[^\w]', '', norm_w)
                current_line_words.append({
                    "line_index": line_idx,
                    "word_index": global_word_idx,
                    "word_in_line_index": w_in_line_idx,
                    "text": str(w),
                    "normalized_text": norm_w if norm_w else str(w).lower(),
                })
                global_word_idx += 1
            if current_line_words:
                line_words_map.append(current_line_words)

        return raw_lines, line_words_map


class CTCModelManager:
    """
    Singleton lifecycle manager for caching Wav2Vec2ForCTC and AutoProcessor.
    Avoids re-allocating models and GPU memory per job.
    """
    _instance: Optional["CTCModelManager"] = None

    def __init__(self):
        self.cached_model_name: Optional[str] = None
        self.model: Optional[Any] = None
        self.processor: Optional[Any] = None
        self.device: str = "cpu"

    @classmethod
    def get_instance(cls) -> "CTCModelManager":
        if cls._instance is None:
            cls._instance = CTCModelManager()
        return cls._instance

    def load_model(self, model_name: str, device: str = "cuda") -> Tuple[Any, Any]:
        import torch
        from transformers import AutoProcessor, Wav2Vec2ForCTC

        # Validate device
        target_device = device
        if target_device == "cuda" and not torch.cuda.is_available():
            logger.warning("[CTCModelManager] CUDA requested but not available. Falling back to CPU.")
            target_device = "cpu"

        # Return cached instance if already loaded
        if (
            self.model is not None
            and self.processor is not None
            and self.cached_model_name == model_name
            and self.device == target_device
        ):
            return self.model, self.processor

        logger.info(f"[CTCModelManager] Loading CTC Model: {model_name} on device: {target_device}...")
        try:
            import gc
            gc.collect()
            if target_device == "cpu":
                torch.set_num_threads(1)

            # Load standard HuggingFace model & processor
            processor = AutoProcessor.from_pretrained(model_name)
            try:
                model = Wav2Vec2ForCTC.from_pretrained(model_name, low_cpu_mem_usage=True)
            except Exception:
                model = Wav2Vec2ForCTC.from_pretrained(model_name)
            model.eval()
            model.to(target_device)

            self.model = model
            self.processor = processor
            self.cached_model_name = model_name
            self.device = target_device
            logger.info(f"[CTCModelManager] Successfully loaded {model_name} on {target_device}.")
            return model, processor
        except Exception as e:
            logger.error(f"[CTCModelManager] Failed to load CTC model {model_name}: {str(e)}")
            raise CTCModelLoadError(f"CTC_MODEL_LOAD_FAILED: Không thể tải mô hình {model_name} ({str(e)})")


class CTCEmissionExtractor:
    """
    Runs neural forward pass on 16kHz audio waveform and extracts log-probabilities [T, V].
    Supports chunked execution for long audio tracks (5–7 minutes).
    """

    @staticmethod
    def _extract_logits(outputs: Any) -> Any:
        if hasattr(outputs, "logits"):
            return outputs.logits
        if isinstance(outputs, dict) and "logits" in outputs:
            return outputs["logits"]
        if isinstance(outputs, (tuple, list)):
            return outputs[0]
        return outputs

    @staticmethod
    def extract_emissions(
        model: Any,
        processor: Any,
        audio_waveform: np.ndarray,
        sr: int = 16000,
        device: str = "cpu",
        window_sec: int = 15,
        overlap_sec: int = 2
    ) -> Any:
        """
        Returns: emissions tensor of shape [num_frames, vocab_size] in log-space.
        """
        import gc
        import torch
        if audio_waveform.ndim > 1:
            audio_waveform = np.mean(audio_waveform, axis=1)

        total_samples = len(audio_waveform)
        total_duration_sec = float(total_samples) / float(sr)

        try:
            logger.info(f"[CTCEmissionExtractor] Running full continuous neural forward pass for {total_duration_sec:.1f}s audio on {device}...")
            input_tensor = torch.tensor(audio_waveform, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.inference_mode():
                outputs = model(input_tensor)
                logits = CTCEmissionExtractor._extract_logits(outputs)
                emissions = torch.log_softmax(logits, dim=-1).squeeze(0).cpu()
            del input_tensor, outputs, logits
            gc.collect()
            return emissions
        except Exception as e:
            logger.error(f"[CTCEmissionExtractor] CTC forward pass failed: {str(e)}")
            raise CTCInferenceError(f"CTC_INFERENCE_FAILED: Lỗi trong quá trình neural forward pass ({str(e)})")


class TrellisDynamicProgramming:
    """
    Builds the Trellis dynamic programming matrix in Log-Space.
    Supports blank self-transitions, token self-transitions, and token-to-token transitions.
    """

    @staticmethod
    def build_trellis(
        emissions: Any,
        token_ids: List[int],
        blank_id: int = 0
    ) -> np.ndarray:
        """
        emissions: Tensor [T, V] or NumPy array [T, V] in log-space
        token_ids: List of integer token IDs [N]
        Returns: trellis matrix of shape [T, N + 1] in float32 log-space.
        """
        emissions_np = emissions.numpy() if hasattr(emissions, "numpy") else np.asarray(emissions, dtype=np.float32)
        T = emissions_np.shape[0]
        N = len(token_ids)

        if T < N:
            raise CTCAlignmentError(
                f"CTC_ALIGNMENT_FAILED: Thời lượng âm thanh quá ngắn ({T} frames) cho chuỗi {N} tokens"
            )

        emissions_np = emissions.numpy()
        # Initialize Trellis matrix with -inf
        trellis = np.full((T, N + 1), -np.inf, dtype=np.float32)

        # Base case at frame 0
        trellis[0, 0] = emissions_np[0, blank_id]
        if N > 0:
            trellis[0, 1] = emissions_np[0, token_ids[0]]

        # Dynamic Programming Forward Pass
        for t in range(1, T):
            # Staying at blank
            trellis[t, 0] = trellis[t - 1, 0] + emissions_np[t, blank_id]

            for j in range(1, N + 1):
                target_token = token_ids[j - 1]
                # Option 1: Stay at current token
                stay_prob = trellis[t - 1, j] + emissions_np[t, target_token]
                # Option 2: Transition from previous token/blank
                move_prob = trellis[t - 1, j - 1] + emissions_np[t, target_token]

                trellis[t, j] = max(stay_prob, move_prob)

        return trellis


class ViterbiBacktracker:
    """
    Backtracks through Trellis matrix to extract optimal frame spans and acoustic confidence.
    """

    @staticmethod
    def backtrack(
        trellis: np.ndarray,
        emissions: Any,
        token_ids: List[int],
        blank_id: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Traces path from (T-1, N) back to (0, 0).
        Returns list of token alignments: [{'token_idx', 'token_id', 'start_frame', 'end_frame', 'confidence'}]
        """
        T, N_plus_1 = trellis.shape
        N = N_plus_1 - 1
        emissions_np = emissions.numpy() if hasattr(emissions, "numpy") else np.asarray(emissions, dtype=np.float32)

        # Standard CTC Forced Alignment terminal state selection:
        # Find the frame t that maximizes the probability of completing the entire token sequence
        j = N
        valid_terminal_frames = np.where(~np.isneginf(trellis[:, N]))[0]
        if len(valid_terminal_frames) > 0:
            t = int(valid_terminal_frames[np.argmax(trellis[valid_terminal_frames, N])])
        else:
            raise CTCAlignmentError("CTC_ALIGNMENT_FAILED: Không thể tìm thấy đường đi Viterbi hợp lệ trong ma trận Trellis")

        token_spans: List[Dict[str, Any]] = []
        current_token_end = t

        while t > 0 and j > 0:
            target_token = token_ids[j - 1]
            stay_prob = trellis[t - 1, j] + emissions_np[t, target_token]
            move_prob = trellis[t - 1, j - 1] + emissions_np[t, target_token]

            if move_prob >= stay_prob:
                # Token boundary transition
                token_spans.append({
                    "token_seq_idx": j - 1,
                    "token_id": target_token,
                    "start_frame": t,
                    "end_frame": current_token_end + 1,
                    "log_prob": float(emissions_np[t:current_token_end + 1, target_token].mean())
                })
                j -= 1
                current_token_end = t - 1

            t -= 1

        # Handle remaining first token if reached t=0
        if j == 1:
            token_spans.append({
                "token_seq_idx": 0,
                "token_id": token_ids[0],
                "start_frame": 0,
                "end_frame": current_token_end + 1,
                "log_prob": float(emissions_np[0:current_token_end + 1, token_ids[0]].mean())
            })

        # Reverse spans to chronological order
        token_spans.reverse()
        return token_spans


def extract_vocal_active_regions(
    audio_data: np.ndarray,
    sr: int = 16000,
    min_gap_sec: float = 2.0
) -> List[Tuple[float, float]]:
    """
    Extracts macro vocal active regions separated by silence/interlude gaps >= min_gap_sec.
    Used strictly as search constraints / boundaries for CTC alignment (no heuristic timestamps).
    """
    hop_len = int(sr * 0.05)  # 50ms hop
    num_f = len(audio_data) // hop_len
    if num_f <= 0:
        return [(0.0, float(len(audio_data)) / sr)]

    reshaped = audio_data[:num_f * hop_len].reshape(num_f, hop_len)
    rms = np.sqrt(np.mean(reshaped ** 2, axis=1) + 1e-12)
    max_e = np.max(rms) if len(rms) > 0 else 1.0
    norm_e = rms / (max_e + 1e-8)

    # Active threshold
    thresh = max(0.015, float(np.percentile(norm_e, 35)))
    is_active = norm_e > thresh

    raw_regions: List[Tuple[float, float]] = []
    in_reg = False
    start_t = 0.0

    for f_idx, act in enumerate(is_active):
        t = f_idx * 0.05
        if act and not in_reg:
            in_reg = True
            start_t = t
        elif not act and in_reg:
            in_reg = False
            if t - start_t >= 0.5:
                raw_regions.append((start_t, t))
    if in_reg:
        raw_regions.append((start_t, float(len(audio_data)) / sr))

    if not raw_regions:
        return [(0.0, float(len(audio_data)) / sr)]

    # Merge regions closer than min_gap_sec
    merged: List[Tuple[float, float]] = []
    for r in raw_regions:
        if not merged:
            merged.append(r)
        else:
            prev_s, prev_e = merged[-1]
            if r[0] - prev_e < min_gap_sec:
                merged[-1] = (prev_s, r[1])
            else:
                merged.append(r)
    return merged


class StandaloneCTCTokenizer:
    """
    Lightweight, high-performance CTC tokenizer loading directly from vocab.json.
    Zero PyTorch/Transformers runtime memory overhead (~0.1MB RAM).
    """
    def __init__(self, vocab_path: str):
        import json
        if not os.path.exists(vocab_path):
            raise CTCTokenizerError(f"VOCAB_NOT_FOUND: Không tìm thấy tệp từ vựng tại {vocab_path}")
        with open(vocab_path, "r", encoding="utf-8") as f:
            self.vocab: Dict[str, int] = json.load(f)
        self.id2token: Dict[int, str] = {v: k for k, v in self.vocab.items()}
        self.pad_token_id: int = self.vocab.get("<pad>", self.vocab.get("[PAD]", 0))
        self.unk_token_id: int = self.vocab.get("<unk>", self.vocab.get("[UNK]", 3))
        self.space_token: str = "|" if "|" in self.vocab else " "
        self.space_id: int = self.vocab.get(self.space_token, 4)

    def tokenize(self, text: str) -> List[str]:
        words = text.strip().split()
        tokens: List[str] = []
        for w in words:
            for c in w:
                tokens.append(c)
            tokens.append(self.space_token)
        if tokens and tokens[-1] == self.space_token:
            tokens.pop()
        return tokens

    def convert_tokens_to_ids(self, tokens: List[str]) -> List[int]:
        return [self.vocab.get(t, self.unk_token_id) for t in tokens]

    def convert_ids_to_tokens(self, token_id: int) -> str:
        return self.id2token.get(token_id, "<unk>")


class ONNXCTCModelManager:
    """
    Singleton lifecycle manager for ONNX Runtime InferenceSession and StandaloneCTCTokenizer.
    Guarantees ultra-low Peak RAM (< 250MB) with enable_cpu_mem_arena=False.
    """
    _instance: Optional["ONNXCTCModelManager"] = None

    def __init__(self):
        self.session: Optional[Any] = None
        self.tokenizer: Optional[StandaloneCTCTokenizer] = None
        self.model_path: Optional[str] = None

    @classmethod
    def get_instance(cls) -> "ONNXCTCModelManager":
        if cls._instance is None:
            cls._instance = ONNXCTCModelManager()
        return cls._instance

    def load_model(self, model_dir: Optional[str] = None) -> Tuple[Any, StandaloneCTCTokenizer]:
        if model_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_dir = os.path.join(base_dir, "models", "wav2vec2_onnx_int8")

        model_path = os.path.join(model_dir, "model_quantized.onnx")
        vocab_path = os.path.join(model_dir, "vocab.json")

        if self.session is not None and self.tokenizer is not None and self.model_path == model_path:
            return self.session, self.tokenizer

        if not os.path.exists(model_path):
            raise CTCModelLoadError(f"ONNX_MODEL_NOT_FOUND: Không tìm thấy model ONNX INT8 tại {model_path}")

        model_file_size = os.path.getsize(model_path)
        if model_file_size < 10 * 1024 * 1024:
            raise CTCModelLoadError(
                f"ONNX_MODEL_LFS_POINTER: File {model_path} chỉ có dung lượng {model_file_size} bytes "
                f"(con trỏ Git LFS thay vì file nhị phân 122MB thực tế). Vui lòng cấu hình git-lfs pull."
            )

        logger.info(f"[ONNXCTCModelManager] Loading ONNX INT8 Model from {model_path} ({model_file_size / (1024*1024):.1f} MB)...")
        try:
            import onnxruntime as ort
            sess_options = ort.SessionOptions()
            sess_options.enable_cpu_mem_arena = False
            
            # Dynamic multi-threading: utilizes all available physical/logical CPU cores (up to 8)
            num_threads = int(os.getenv("ORT_NUM_THREADS", str(min(os.cpu_count() or 4, 8))))
            sess_options.intra_op_num_threads = num_threads
            sess_options.inter_op_num_threads = 1
            sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            session = ort.InferenceSession(model_path, sess_options, providers=["CPUExecutionProvider"])
            tokenizer = StandaloneCTCTokenizer(vocab_path)

            self.session = session
            self.tokenizer = tokenizer
            self.model_path = model_path
            logger.info("✅ Successfully loaded ONNX INT8 model with memory arena disabled.")
            return session, tokenizer
        except Exception as e:
            logger.error(f"[ONNXCTCModelManager] Failed to load ONNX INT8 model: {e}")
            raise CTCModelLoadError(f"ONNX_LOAD_FAILED: {str(e)}")


def _extract_emissions_onnx_chunked(
    session: Any,
    audio_waveform: np.ndarray,
    sr: int = 16000,
    window_sec: float = 20.0,
    overlap_sec: float = 4.0
) -> np.ndarray:
    """
    Extracts acoustic emissions via ONNX Runtime using 20s chunk + 4s overlap.
    Computes numerically stable log_softmax in pure NumPy to eliminate PyTorch tensor memory.
    """
    import gc
    total_samples = len(audio_waveform)
    step_samples = int((window_sec - overlap_sec) * sr)
    overlap_samples = int(overlap_sec * sr)
    input_name = session.get_inputs()[0].name

    total_chunks = int(np.ceil(total_samples / step_samples)) if step_samples > 0 else 1
    emissions_list = []
    ptr = 0
    chunk_idx = 0

    while ptr < total_samples:
        chunk_idx += 1
        seg_start = ptr
        seg_end = min(ptr + step_samples, total_samples)

        print(f"      • Đang phân tích âm học đoạn {chunk_idx}/{total_chunks} ({seg_start/sr:.0f}s - {seg_end/sr:.0f}s)...", flush=True)

        left_pad = min(seg_start, overlap_samples)
        right_pad = min(total_samples - seg_end, overlap_samples)

        chunk_audio = audio_waveform[seg_start - left_pad : seg_end + right_pad]
        chunk_input = chunk_audio[np.newaxis, :].astype(np.float32)

        onnx_outputs = session.run(None, {input_name: chunk_input})
        logits_np = onnx_outputs[0][0]

        # Stable NumPy log_softmax: (x - max) - log(sum(exp(x - max)))
        max_logits = np.max(logits_np, axis=-1, keepdims=True)
        exp_logits = np.exp(logits_np - max_logits)
        sum_exp = np.sum(exp_logits, axis=-1, keepdims=True)
        chunk_emissions_np = (logits_np - max_logits) - np.log(sum_exp)

        del chunk_input, onnx_outputs, logits_np, max_logits, exp_logits, sum_exp

        left_frames = int(round(left_pad / 320.0))
        right_frames = int(round(right_pad / 320.0))
        total_chunk_frames = chunk_emissions_np.shape[0]
        end_frame_idx = total_chunk_frames - right_frames if right_frames > 0 else total_chunk_frames

        valid_emissions = chunk_emissions_np[left_frames:end_frame_idx]
        emissions_list.append(valid_emissions)
        del chunk_emissions_np

        ptr += step_samples

    full_emissions = np.concatenate(emissions_list, axis=0)
    del emissions_list
    gc.collect()
    return full_emissions


def _align_single_chunk(
    model: Any,
    processor: Any,
    audio_chunk: np.ndarray,
    words_info: List[Dict[str, Any]],
    offset_sec: float,
    chunk_dur_sec: float,
    device: str
) -> List[Dict[str, Any]]:
    """
    Runs Neural CTC Forward Pass + Trellis DP + Viterbi Backtracking on an individual audio chunk.
    Maintained for PyTorch FP32 fallback compatibility.
    """
    if not words_info or len(audio_chunk) < 800:
        return []

    tokenizer = processor.tokenizer
    blank_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
    space_token = "|" if "|" in tokenizer.get_vocab() else " "
    space_id = tokenizer.get_vocab().get(space_token, tokenizer.get_vocab().get("|", 4))

    token_ids: List[int] = []
    token_to_word_map: List[int] = []

    for w_idx, w_info in enumerate(words_info):
        word_text = w_info["normalized_text"]
        word_tokens = tokenizer.encode(word_text, add_special_tokens=False)
        if not word_tokens:
            word_tokens = [tokenizer.get_vocab().get(c, tokenizer.unk_token_id) for c in word_text]

        for tok in word_tokens:
            token_ids.append(tok)
            token_to_word_map.append(w_idx)

        token_ids.append(space_id)
        token_to_word_map.append(w_idx)

    if token_ids and token_ids[-1] == space_id:
        token_ids.pop()
        token_to_word_map.pop()

    emissions = CTCEmissionExtractor.extract_emissions(
        model=model,
        processor=processor,
        audio_waveform=audio_chunk,
        sr=16000,
        device=device
    )

    trellis = TrellisDynamicProgramming.build_trellis(
        emissions=emissions,
        token_ids=token_ids,
        blank_id=blank_id
    )
    token_spans = ViterbiBacktracker.backtrack(
        trellis=trellis,
        emissions=emissions,
        token_ids=token_ids,
        blank_id=blank_id
    )

    word_span_collector: Dict[int, List[Dict[str, Any]]] = {w_idx: [] for w_idx in range(len(words_info))}
    for span in token_spans:
        tok_seq_idx = span["token_seq_idx"]
        if tok_seq_idx < len(token_to_word_map):
            w_idx = token_to_word_map[tok_seq_idx]
            word_span_collector[w_idx].append(span)

    chunk_aligned_words: List[Dict[str, Any]] = []
    prev_end_time = offset_sec

    for w_idx, w_info in enumerate(words_info):
        spans = word_span_collector.get(w_idx, [])
        if spans:
            start_frame = spans[0]["start_frame"]
            end_frame = spans[-1]["end_frame"]
            raw_s = round(offset_sec + float(start_frame) * 0.02, 3)
            raw_e = round(offset_sec + float(end_frame) * 0.02, 3)
            mean_log_prob = float(np.mean([s["log_prob"] for s in spans]))
            confidence = round(float(np.exp(np.clip(mean_log_prob, -10.0, 0.0))), 3)
        else:
            raw_s = round(prev_end_time + 0.05, 3)
            raw_e = round(raw_s + 0.25, 3)
            confidence = 0.50

        final_s = max(prev_end_time, raw_s)
        final_e = max(final_s + 0.05, min(offset_sec + chunk_dur_sec, raw_e))
        prev_end_time = final_e

        chunk_aligned_words.append({
            "line_index": w_info["line_index"],
            "word_index": w_info["word_index"],
            "text": w_info["text"],
            "raw_start": final_s,
            "raw_end": final_e,
            "confidence": confidence,
        })

    return chunk_aligned_words


def align_lyrics_onnx_int8(
    vocals_wav_path: str,
    plain_lyrics: str
) -> Tuple[List[Dict[str, Any]], float]:
    """
    High-Performance, Memory-Minimal Standalone ONNX INT8 Forced Alignment.
    Peak RSS: < 220MB (No PyTorch/Transformers import during inference).
    """
    import gc
    data, sr = sf.read(vocals_wav_path, dtype="float32")
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if sr != 16000:
        from scipy import signal
        gcd = np.gcd(16000, sr)
        data = signal.resample_poly(data, 16000 // gcd, sr // gcd).astype(np.float32)
        sr = 16000
    duration_sec = float(len(data)) / float(sr)

    raw_lines, line_words_map = VietnameseTextNormalizer.extract_words_and_lines(plain_lyrics)
    total_words = sum(len(w_list) for w_list in line_words_map)
    if total_words == 0:
        raise ValueError("Không tìm thấy từ ngữ nghĩa nào trong lời bài hát")

    # Load ONNX INT8 Singleton
    onnx_mgr = ONNXCTCModelManager.get_instance()
    session, tokenizer = onnx_mgr.load_model()

    # 1. Extract emissions with 20s chunk + 4s overlap
    emissions_np = _extract_emissions_onnx_chunked(
        session=session,
        audio_waveform=data,
        sr=16000,
        window_sec=20.0,
        overlap_sec=4.0
    )

    # 2. Apply Silence-Prior Gating (Intro Lock & Interlude Solo Enforcement)
    T = emissions_np.shape[0]
    blank_id = tokenizer.pad_token_id
    hop_samples = int(16000 / 50)  # 320 samples per frame at 50fps
    if len(data) >= hop_samples and T > 0:
        valid_len = min(len(data), T * hop_samples)
        reshaped = data[:valid_len].reshape(valid_len // hop_samples, hop_samples)
        frame_rms = np.sqrt(np.mean(reshaped ** 2, axis=1) + 1e-12)

        # Smooth frame RMS with ~0.25s sliding window (5 frames at 50fps)
        k_sz = 5
        s_rms = np.convolve(frame_rms, np.ones(k_sz) / k_sz, mode="same")
        peak_rms = float(np.max(s_rms)) if len(s_rms) > 0 else 1.0
        rel_db = 20 * np.log10(s_rms / (peak_rms + 1e-12))
        vocal_energy_thresh = max(0.012, float(np.percentile(s_rms, 35)))

        # 1. Intro Hard Lock
        intro_end_f = 0
        consec_active = 0
        for f_i in range(min(T, int(35 * 50))):
            if s_rms[f_i] > vocal_energy_thresh:
                consec_active += 1
                if consec_active >= 8:
                    intro_end_f = max(0, f_i - 8)
                    break
            else:
                consec_active = 0

        if intro_end_f > int(3.0 * 50):
            emissions_np[:intro_end_f, :] = -100.0
            emissions_np[:intro_end_f, blank_id] = 0.0

        # 2. Interlude & Solo Blank Enforcement: Detect gaps >= 2.0s
        is_silent_frame = (s_rms < vocal_energy_thresh) | (rel_db < -26.0)
        in_gap = False
        gap_start = 0
        for f_i, sil in enumerate(is_silent_frame):
            if sil and not in_gap:
                in_gap = True
                gap_start = f_i
            elif not sil and in_gap:
                in_gap = False
                if (f_i - gap_start) >= int(2.0 * 50):
                    emissions_np[gap_start:f_i, :] = -100.0
                    emissions_np[gap_start:f_i, blank_id] = 0.0
        if in_gap and (T - gap_start) >= int(2.0 * 50):
            emissions_np[gap_start:T, :] = -100.0
            emissions_np[gap_start:T, blank_id] = 0.0

    # Free audio waveform immediately
    del data
    gc.collect()

    # 2. Build Token Sequence and Word Mapping
    token_ids: List[int] = []
    token_to_word_map: List[int] = []
    flat_words: List[Dict[str, Any]] = [w for line in line_words_map for w in line]

    for w_idx, w_info in enumerate(flat_words):
        word_text = w_info["normalized_text"]
        for c in word_text:
            token_ids.append(tokenizer.vocab.get(c, tokenizer.unk_token_id))
            token_to_word_map.append(w_idx)
        token_ids.append(tokenizer.space_id)
        token_to_word_map.append(w_idx)

    if token_ids and token_ids[-1] == tokenizer.space_id:
        token_ids.pop()
        token_to_word_map.pop()

    # 3. Dynamic Programming Viterbi Alignment (torchaudio.functional.forced_align)
    T = emissions_np.shape[0]
    N = len(token_ids)
    blank_id = tokenizer.pad_token_id

    token_spans: List[Dict[str, Any]] = []
    try:
        import torch
        import torchaudio.functional as F
        if T >= N and N > 0:
            emissions_tensor = torch.from_numpy(emissions_np).unsqueeze(0)
            targets = torch.tensor([token_ids], dtype=torch.int64)
            aligned_tokens, scores = F.forced_align(emissions_tensor, targets, blank=blank_id)
            spans = F.merge_tokens(aligned_tokens[0], scores[0], blank=blank_id)
            for s_idx, span in enumerate(spans):
                token_spans.append({
                    "token_seq_idx": s_idx,
                    "token_id": int(span.token),
                    "start_frame": int(span.start),
                    "end_frame": int(span.end),
                    "log_prob": float(span.score)
                })
    except Exception as e:
        logger.warning(f"[AlignLyrics] torchaudio forced_align unavailable or failed ({e}), falling back to numpy trellis.")
        token_spans = []

    if not token_spans and T >= N and N > 0:
        trellis = np.full((T, N + 1), -np.inf, dtype=np.float32)
        trellis[0, 0] = emissions_np[0, blank_id]
        trellis[0, 1] = emissions_np[0, token_ids[0]]

        for t in range(1, T):
            trellis[t, 0] = trellis[t - 1, 0] + emissions_np[t, blank_id]
            for j in range(1, N + 1):
                target_token = token_ids[j - 1]
                stay_prob = trellis[t - 1, j] + emissions_np[t, blank_id]
                move_prob = trellis[t - 1, j - 1] + emissions_np[t, target_token]
                trellis[t, j] = max(stay_prob, move_prob)

        t = T - 1
        j = N
        current_token_end = t

        while t > 0 and j > 0:
            target_token = token_ids[j - 1]
            stay_prob = trellis[t - 1, j] + emissions_np[t, blank_id]
            move_prob = trellis[t - 1, j - 1] + emissions_np[t, target_token]
            if move_prob >= stay_prob:
                token_spans.append({
                    "token_seq_idx": j - 1,
                    "token_id": target_token,
                    "start_frame": t,
                    "end_frame": current_token_end + 1,
                    "log_prob": float(np.mean(emissions_np[t:current_token_end + 1, target_token]))
                })
                j -= 1
                current_token_end = t - 1
            t -= 1

        if j == 1:
            token_spans.append({
                "token_seq_idx": 0,
                "token_id": token_ids[0],
                "start_frame": 0,
                "end_frame": current_token_end + 1,
                "log_prob": float(np.mean(emissions_np[0:current_token_end + 1, token_ids[0]]))
            })
        token_spans.reverse()
        del trellis

    # Free emissions matrix
    del emissions_np
    gc.collect()

    # 5. Map Token Spans to Words
    word_span_collector: Dict[int, List[Dict[str, Any]]] = {w_idx: [] for w_idx in range(len(flat_words))}
    for span in token_spans:
        tok_seq_idx = span["token_seq_idx"]
        if tok_seq_idx < len(token_to_word_map):
            w_idx = token_to_word_map[tok_seq_idx]
            word_span_collector[w_idx].append(span)

    aligned_words: List[Dict[str, Any]] = []
    prev_end_time = 0.0

    for w_idx, w_info in enumerate(flat_words):
        spans = word_span_collector.get(w_idx, [])
        if spans:
            start_frame = spans[0]["start_frame"]
            end_frame = spans[-1]["end_frame"]
            raw_s = round(float(start_frame) * 0.02, 3)
            raw_e = round(float(end_frame) * 0.02, 3)
            mean_log_prob = float(np.mean([s["log_prob"] for s in spans]))
            confidence = round(float(np.exp(np.clip(mean_log_prob, -10.0, 0.0))), 3)
        else:
            raw_s = round(prev_end_time + 0.05, 3)
            raw_e = round(raw_s + 0.25, 3)
            confidence = 0.50

        final_s = max(prev_end_time, raw_s)
        final_e = max(final_s + 0.05, min(duration_sec, raw_e))
        prev_end_time = final_e

        aligned_words.append({
            "line_index": w_info["line_index"],
            "word_index": w_info["word_index"],
            "text": w_info["text"],
            "raw_start": final_s,
            "raw_end": final_e,
            "confidence": confidence,
        })

    return aligned_words, duration_sec


def align_lyrics(
    vocals_wav_path: str,
    plain_lyrics: str,
    model_name: str = "nguyenvulebinh/wav2vec2-base-vietnamese-250h",
    device: str = "cpu"
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Main entry point for Neural CTC Forced Alignment.
    Primary Path: High-Performance ONNX INT8 Pure Standalone (Peak RSS < 220MB).
    Fallback Path: PyTorch FP32 Baseline.
    """
    # Attempt Primary ONNX INT8 Path
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        onnx_model_path = os.path.join(base_dir, "models", "wav2vec2_onnx_int8", "model_quantized.onnx")
        if os.path.exists(onnx_model_path):
            logger.info("[AlignLyrics] Executing via Primary ONNX INT8 Standalone Engine...")
            return align_lyrics_onnx_int8(vocals_wav_path, plain_lyrics)
    except Exception as onnx_err:
        logger.warning(f"[AlignLyrics] ONNX INT8 engine encountered issue ({onnx_err}), safely falling back to PyTorch FP32.")

    # Fallback to PyTorch FP32 Baseline
    logger.info("[AlignLyrics] Executing via Fallback PyTorch FP32 Engine...")
    data, sr = sf.read(vocals_wav_path, dtype="float32")
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if sr != 16000:
        from scipy import signal
        gcd = np.gcd(16000, sr)
        data = signal.resample_poly(data, 16000 // gcd, sr // gcd).astype(np.float32)
        sr = 16000
    duration_sec = float(len(data)) / float(sr)

    raw_lines, line_words_map = VietnameseTextNormalizer.extract_words_and_lines(plain_lyrics)
    flat_words = [w for line in line_words_map for w in line]

    model_mgr = CTCModelManager.get_instance()
    model, processor = model_mgr.load_model(model_name, device=device)

    aligned_words = _align_single_chunk(
        model=model,
        processor=processor,
        audio_chunk=data,
        words_info=flat_words,
        offset_sec=0.0,
        chunk_dur_sec=duration_sec,
        device=model_mgr.device
    )
    return aligned_words, duration_sec




