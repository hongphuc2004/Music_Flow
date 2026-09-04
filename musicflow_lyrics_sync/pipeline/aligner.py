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
import torch
from transformers import AutoProcessor, Wav2Vec2ForCTC

try:
    from pipeline.macro_aligner import MacroAligner
except ImportError:
    from macro_aligner import MacroAligner  # type: ignore

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
        self.model: Optional[Wav2Vec2ForCTC] = None
        self.processor: Optional[AutoProcessor] = None
        self.device: str = "cpu"

    @classmethod
    def get_instance(cls) -> "CTCModelManager":
        if cls._instance is None:
            cls._instance = CTCModelManager()
        return cls._instance

    def load_model(self, model_name: str, device: str = "cuda") -> Tuple[Wav2Vec2ForCTC, AutoProcessor]:
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

            # Check for pre-compiled TorchScript int8 model (from Docker build)
            cache_dir = os.getenv("MODEL_CACHE_DIR", "/app/model_cache")
            jit_path = os.path.join(cache_dir, "wav2vec2_int8.pt")
            proc_path = os.path.join(cache_dir, "processor")

            # Fallback to local relative cache if running outside container
            if not os.path.exists(jit_path):
                local_cache = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model_cache")
                if os.path.exists(os.path.join(local_cache, "wav2vec2_int8.pt")):
                    jit_path = os.path.join(local_cache, "wav2vec2_int8.pt")
                    proc_path = os.path.join(local_cache, "processor")

            if os.path.exists(jit_path) and target_device == "cpu":
                logger.info(f"[CTCModelManager] Loading pre-compiled TorchScript int8 model from {jit_path} (~116MB)...")
                processor = AutoProcessor.from_pretrained(proc_path if os.path.exists(proc_path) else model_name)
                model = torch.jit.load(jit_path, map_location=target_device)
                model.eval()

                self.model = model
                self.processor = processor
                self.cached_model_name = model_name
                self.device = target_device
                logger.info(f"[CTCModelManager] Pre-compiled TorchScript int8 model loaded on {target_device} with ultra-low RAM footprint (~116MB, Zero Spikes).")
                return model, processor

            # Fallback: Standard HuggingFace load
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
    def _extract_logits(outputs: Any) -> torch.Tensor:
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
        processor: AutoProcessor,
        audio_waveform: np.ndarray,
        sr: int = 16000,
        device: str = "cpu",
        window_sec: int = 60,
        overlap_sec: int = 3
    ) -> torch.Tensor:
        """
        Returns: emissions tensor of shape [num_frames, vocab_size] in log-space.
        """
        if audio_waveform.ndim > 1:
            audio_waveform = np.mean(audio_waveform, axis=1)

        total_samples = len(audio_waveform)
        total_duration_sec = float(total_samples) / float(sr)

        try:
            # For tracks <= window_sec + overlap_sec, run single forward pass
            if total_duration_sec <= window_sec + overlap_sec:
                input_tensor = torch.tensor(audio_waveform, dtype=torch.float32).unsqueeze(0).to(device)
                with torch.inference_mode():
                    outputs = model(input_tensor)
                    logits = CTCEmissionExtractor._extract_logits(outputs)
                    emissions = torch.log_softmax(logits, dim=-1).squeeze(0).cpu()
                return emissions

            # For long audio (> 60s), run chunked sliding window with overlap
            logger.info(f"[CTCEmissionExtractor] Running chunked neural forward pass for {total_duration_sec:.1f}s audio...")
            window_samples = int(window_sec * sr)
            overlap_samples = int(overlap_sec * sr)
            step_samples = window_samples - overlap_samples

            emissions_list: List[torch.Tensor] = []
            curr_start = 0

            while curr_start < total_samples:
                curr_end = min(total_samples, curr_start + window_samples)
                chunk = audio_waveform[curr_start:curr_end]
                input_tensor = torch.tensor(chunk, dtype=torch.float32).unsqueeze(0).to(device)

                with torch.inference_mode():
                    outputs = model(input_tensor)
                    logits = CTCEmissionExtractor._extract_logits(outputs)
                    chunk_emissions = torch.log_softmax(logits, dim=-1).squeeze(0).cpu()

                # Calculate frame trim for overlap boundary
                if curr_start == 0:
                    # First chunk: keep until end minus half overlap
                    keep_end_frames = chunk_emissions.size(0) - (int((overlap_sec / 2) * 50) if curr_end < total_samples else 0)
                    emissions_list.append(chunk_emissions[:keep_end_frames])
                elif curr_end >= total_samples:
                    # Last chunk: keep from half overlap to end
                    keep_start_frames = int((overlap_sec / 2) * 50)
                    emissions_list.append(chunk_emissions[keep_start_frames:])
                else:
                    # Intermediate chunk: trim both sides
                    keep_start_frames = int((overlap_sec / 2) * 50)
                    keep_end_frames = chunk_emissions.size(0) - int((overlap_sec / 2) * 50)
                    emissions_list.append(chunk_emissions[keep_start_frames:keep_end_frames])

                if curr_end >= total_samples:
                    break
                curr_start += step_samples

            full_emissions = torch.cat(emissions_list, dim=0)
            return full_emissions

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
        emissions: torch.Tensor,
        token_ids: List[int],
        blank_id: int = 0
    ) -> np.ndarray:
        """
        emissions: Tensor [T, V] in log-space
        token_ids: List of integer token IDs [N]
        Returns: trellis matrix of shape [T, N + 1] in float32 log-space.
        """
        T = emissions.size(0)
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
        emissions: torch.Tensor,
        token_ids: List[int],
        blank_id: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Traces path from (T-1, N) back to (0, 0).
        Returns list of token alignments: [{'token_idx', 'token_id', 'start_frame', 'end_frame', 'confidence'}]
        """
        T, N_plus_1 = trellis.shape
        N = N_plus_1 - 1
        emissions_np = emissions.numpy()

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
    num_frames = emissions.size(0)
    frame_rate = float(num_frames) / float(chunk_dur_sec) if chunk_dur_sec > 0 else 50.0

    # Apply Silence-Prior Gating: guarantee blank state during intro, solos, and interludes
    hop_samples = int(16000 / 50) # 320 samples per frame at 50fps
    if len(audio_chunk) >= hop_samples and num_frames > 0:
        valid_len = min(len(audio_chunk), num_frames * hop_samples)
        reshaped = audio_chunk[:valid_len].reshape(valid_len // hop_samples, hop_samples)
        frame_rms = np.sqrt(np.mean(reshaped ** 2, axis=1) + 1e-12)

        # Smooth frame RMS with ~0.25s sliding window (5 frames at 50fps)
        k_sz = 5
        s_rms = np.convolve(frame_rms, np.ones(k_sz) / k_sz, mode="same")
        peak_rms = float(np.max(s_rms)) if len(s_rms) > 0 else 1.0
        rel_db = 20 * np.log10(s_rms / (peak_rms + 1e-12))

        vocal_energy_thresh = max(0.012, float(np.percentile(s_rms, 35)))
        emissions_gated = emissions.clone()

        # 1. Intro Hard Lock: Detect when singer actually starts singing
        if offset_sec == 0.0:
            intro_end_f = 0
            consec_active = 0
            for f_i in range(min(num_frames, int(35 * 50))): # Search first 35 seconds
                if s_rms[f_i] > vocal_energy_thresh:
                    consec_active += 1
                    if consec_active >= 8: # Sustained vocal onset for >= 160ms
                        intro_end_f = max(0, f_i - 8)
                        break
                else:
                    consec_active = 0

            if intro_end_f > int(3.0 * 50): # Intro silence > 3s
                emissions_gated[:intro_end_f, :] = -100.0
                emissions_gated[:intro_end_f, blank_id] = 0.0
                logger.info(f"[IntroLock] Locked intro silence from 0.0s to {intro_end_f / 50.0:.2f}s as strict blank.")

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
                if (f_i - gap_start) >= int(2.0 * 50): # Gaps >= 2.0s
                    emissions_gated[gap_start:f_i, :] = -100.0
                    emissions_gated[gap_start:f_i, blank_id] = 0.0
        if in_gap and (num_frames - gap_start) >= int(2.0 * 50):
            emissions_gated[gap_start:num_frames, :] = -100.0
            emissions_gated[gap_start:num_frames, blank_id] = 0.0

        emissions = emissions_gated


    token_spans: List[Dict[str, Any]] = []
    try:
        import torchaudio.functional as F
        if emissions.size(0) >= len(token_ids):
            targets = torch.tensor([token_ids], dtype=torch.int64)
            aligned_tokens, scores = F.forced_align(emissions.unsqueeze(0), targets, blank=blank_id)
            spans = F.merge_tokens(aligned_tokens[0], scores[0], blank=blank_id)
            for s_idx, span in enumerate(spans):
                token_spans.append({
                    "token_seq_idx": s_idx,
                    "token_id": span.token,
                    "start_frame": span.start,
                    "end_frame": span.end,
                    "log_prob": float(span.score)
                })
    except Exception as e:
        logger.warning(f"torchaudio forced_align unavailable or failed ({e}), falling back to Trellis DP.")
        token_spans = []

    if not token_spans:
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
            raw_s = round(offset_sec + float(start_frame) / frame_rate, 3)
            raw_e = round(offset_sec + float(end_frame) / frame_rate, 3)
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


def align_lyrics(
    vocals_wav_path: str,
    plain_lyrics: str,
    model_name: str = "nguyenvulebinh/wav2vec2-base-vietnamese-250h",
    device: str = "cuda"
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Main entry point for Phase 9 Real Neural CTC Forced Alignment.
    Returns: (aligned_words_list, audio_duration_sec)
    """
    # 1. Load Audio
    data, sr = sf.read(vocals_wav_path)
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if sr != 16000:
        from scipy import signal
        gcd = np.gcd(16000, sr)
        data = signal.resample_poly(data, 16000 // gcd, sr // gcd)
        sr = 16000
    duration_sec = float(len(data)) / float(sr)

    # 2. Parse Plain Lyrics
    raw_lines, line_words_map = VietnameseTextNormalizer.extract_words_and_lines(plain_lyrics)
    total_words = sum(len(w_list) for w_list in line_words_map)
    if total_words == 0:
        raise ValueError("Không tìm thấy từ ngữ nghĩa nào trong lời bài hát")

    # 3. Load CTC Model & Processor
    model_mgr = CTCModelManager.get_instance()
    model, processor = model_mgr.load_model(model_name, device=device)

    # 4. Two-Pass Macro Anchor Sectioning with Neural Vocal Presence
    # Uses neural ASR greedy emissions to detect true acoustic singing segments and interludes
    try:
        sections = MacroAligner.detect_sections_neural(
            audio_data=data,
            model=model,
            processor=processor,
            sr=sr,
            min_gap_sec=4.5,
            min_block_words=4,
            device=model_mgr.device
        )
    except Exception as e:
        logger.warning(f"MacroAligner neural sectioning error ({e}), falling back to energy partition.")
        try:
            sections = MacroAligner.partition_audio_into_phrases(data, sr=sr, min_gap_sec=3.5, min_section_sec=8.0)
        except Exception:
            sections = []

    if len(sections) > 1 and len(raw_lines) >= len(sections):
        try:
            logger.info(f"[Two-Pass] Detected {len(sections)} macro vocal sections. Partitioning lines...")
            section_texts = [
                sec.get("text") or MacroAligner.decode_section_text(
                    model=model,
                    processor=processor,
                    audio_chunk=data[int(sec["start_sec"] * sr):int(sec["end_sec"] * sr)],
                    device=model_mgr.device
                )
                for sec in sections
            ]

            partitions, match_score = MacroAligner.find_optimal_line_partition(
                raw_lines=raw_lines,
                section_texts=section_texts,
                sections=sections
            )

            if match_score >= 3.0:

                # Capacity Check: Ensure every section has enough acoustic frames for its assigned tokens
                can_partition = True
                for sec_idx, line_indices in enumerate(partitions):
                    sec = sections[sec_idx]
                    sec_words = []
                    for l_idx in line_indices:
                        sec_words.extend(line_words_map[l_idx])
                    sec_token_est = sum(len(w["normalized_text"]) + 1 for w in sec_words)
                    sec_frames = int(sec["duration"] * 50)
                    min_frames_needed = int(sec_token_est * 1.5) + 30
                    if sec_frames < min_frames_needed:
                        logger.warning(
                            f"[Two-Pass] Section {sec_idx} duration {sec['duration']}s ({sec_frames} frames) "
                            f"too short for {sec_token_est} tokens (need >= {min_frames_needed} frames). Falling back to continuous alignment."
                        )
                        can_partition = False
                        break

                if can_partition:
                    logger.info(f"[Two-Pass] Optimal line partition validated (score: {match_score:.1f}). Running micro CTC per section...")
                    aligned_words: List[Dict[str, Any]] = []
                    for sec_idx, line_indices in enumerate(partitions):
                        sec = sections[sec_idx]
                        sec_words = []
                        for l_idx in line_indices:
                            sec_words.extend(line_words_map[l_idx])
                        if not sec_words:
                            continue
                        s_samp = int(sec["start_sec"] * sr)
                        e_samp = int(sec["end_sec"] * sr)
                        sec_audio = data[s_samp:e_samp]

                        sec_aligned = _align_single_chunk(
                            model=model,
                            processor=processor,
                            audio_chunk=sec_audio,
                            words_info=sec_words,
                            offset_sec=sec["start_sec"],
                            chunk_dur_sec=sec["duration"],
                            device=model_mgr.device
                        )
                        aligned_words.extend(sec_aligned)

                    logger.info(f"✅ Two-Pass Macro CTC Alignment aligned {len(aligned_words)} words across {len(sections)} sections.")
                    return aligned_words, duration_sec

        except Exception as e:
            logger.warning(f"[Two-Pass] Section alignment skipped due to ({e}), falling back to continuous alignment.")

    # Fallback / Continuous Pass: Align entire audio with Silence-Prior Gating
    flat_words: List[Dict[str, Any]] = [w for line in line_words_map for w in line]
    aligned_words = _align_single_chunk(
        model=model,
        processor=processor,
        audio_chunk=data,
        words_info=flat_words,
        offset_sec=0.0,
        chunk_dur_sec=duration_sec,
        device=model_mgr.device
    )

    logger.info(f"✅ Real CTC Forced Alignment successfully aligned {len(aligned_words)} words across {duration_sec:.1f}s audio.")
    return aligned_words, duration_sec



