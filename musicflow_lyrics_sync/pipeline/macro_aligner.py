"""
macro_aligner.py — Two-Pass Macro Anchor Alignment & Long-Track Resilient Segmenter
Provides structural anchoring for long audio tracks (3–5 minutes) and isolates errors between song sections.
"""

import difflib
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import soundfile as sf
import torch

logger = logging.getLogger("AlignmentWorker.MacroAligner")


class MacroAligner:
    """
    Identifies structural anchors (macro boundaries) across long audio tracks.
    Prevents error propagation between verses, interludes, and choruses.
    """

    @staticmethod
    def detect_interlude_breaks(
        audio_data: np.ndarray,
        sr: int = 16000,
        min_interlude_sec: float = 3.0,
        energy_rel_thresh_db: float = -26.0
    ) -> List[Tuple[float, float]]:
        """
        Detects significant non-vocal interludes/solos lasting >= min_interlude_sec.
        Uses adaptive smoothed RMS profiling to avoid false-negative silence detection.
        Returns list of interlude time intervals: [(start_sec, end_sec), ...]
        """
        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=1)

        hop_len = int(sr * 0.05) # 50ms frames
        num_frames = len(audio_data) // hop_len
        if num_frames <= 0:
            return []

        reshaped = audio_data[:num_frames * hop_len].reshape(num_frames, hop_len)
        rms = np.sqrt(np.mean(reshaped ** 2, axis=1) + 1e-12)

        # Smooth RMS with ~0.3s sliding window (7 frames at 50ms)
        kernel_size = 7
        smoothed_rms = np.convolve(rms, np.ones(kernel_size) / kernel_size, mode="same")
        peak_rms = float(np.max(smoothed_rms)) if len(smoothed_rms) > 0 else 1.0
        rel_db = 20 * np.log10(smoothed_rms / (peak_rms + 1e-12))

        # Dynamic vocal silence threshold:
        # Either relative to peak (< -26dB) or below 35th percentile of track energy, or < 0.012 absolute RMS
        energy_floor = max(0.012, float(np.percentile(smoothed_rms, 35)))
        is_silent = (smoothed_rms < energy_floor) | (rel_db < energy_rel_thresh_db)

        interludes: List[Tuple[float, float]] = []
        in_silence = False
        silence_start = 0.0

        for idx, silent in enumerate(is_silent):
            t = idx * 0.05
            if silent and not in_silence:
                in_silence = True
                silence_start = t
            elif not silent and in_silence:
                in_silence = False
                silence_dur = t - silence_start
                if silence_dur >= min_interlude_sec:
                    interludes.append((round(silence_start, 2), round(t, 2)))

        if in_silence:
            final_t = float(len(audio_data)) / sr
            if final_t - silence_start >= min_interlude_sec:
                interludes.append((round(silence_start, 2), round(final_t, 2)))

        return interludes

    @staticmethod
    def partition_audio_into_phrases(
        audio_data: np.ndarray,
        sr: int = 16000,
        min_gap_sec: float = 3.0,
        min_section_sec: float = 6.0
    ) -> List[Dict[str, Any]]:
        """
        Splits audio into major vocal sections separated by long interludes (> min_gap_sec).
        Returns list of sections: [{'start_sec': float, 'end_sec': float, 'duration': float}]
        """
        interludes = MacroAligner.detect_interlude_breaks(audio_data, sr=sr, min_interlude_sec=min_gap_sec)
        total_dur = float(len(audio_data)) / sr

        if not interludes:
            return [{"start_sec": 0.0, "end_sec": total_dur, "duration": total_dur}]

        sections: List[Dict[str, Any]] = []
        curr_pos = 0.0

        for int_s, int_e in interludes:
            if int_s - curr_pos >= min_section_sec: # Meaningful vocal section (>= min_section_sec)
                sections.append({
                    "start_sec": curr_pos,
                    "end_sec": int_s,
                    "duration": round(int_s - curr_pos, 2)
                })
            curr_pos = int_e

        if total_dur - curr_pos >= min_section_sec:
            sections.append({
                "start_sec": curr_pos,
                "end_sec": total_dur,
                "duration": round(total_dur - curr_pos, 2)
            })

        return sections if sections else [{"start_sec": 0.0, "end_sec": total_dur, "duration": total_dur}]


    @staticmethod
    def decode_section_text(
        model: Any,
        processor: Any,
        audio_chunk: np.ndarray,
        device: str = "cpu"
    ) -> str:
        """
        Runs fast greedy CTC decoding on an audio section to get approximate transcription.
        """
        if len(audio_chunk) < 1600:
            return ""
        try:
            # Subsample or limit to 60s for fast macro transcription
            sample = audio_chunk[:min(len(audio_chunk), 16000 * 60)]
            input_tensor = torch.tensor(sample, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.inference_mode():
                logits = model(input_tensor).logits
                pred_ids = torch.argmax(logits, dim=-1)
            decoded = processor.batch_decode(pred_ids)[0]
            return decoded.lower().strip()
        except Exception as e:
            logger.warning(f"[MacroAligner] Greedy decode failed: {e}")
            return ""

    @staticmethod
    def detect_sections_neural(
        audio_data: np.ndarray,
        model: Any,
        processor: Any,
        sr: int = 16000,
        min_gap_sec: float = 4.5,
        min_block_words: int = 4,
        device: str = "cpu"
    ) -> List[Dict[str, Any]]:
        """
        Uses neural ASR greedy emissions to detect true acoustic singing segments and interludes.
        Completely immune to instrumental noise (drums, bass, synths).
        Returns list of sections: [{'start_sec': float, 'end_sec': float, 'duration': float, 'text': str, 'word_count': int}]
        """
        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=1)

        total_dur = float(len(audio_data)) / float(sr)
        if total_dur < 15.0 or model is None or processor is None:
            return [{"start_sec": 0.0, "end_sec": total_dur, "duration": total_dur, "text": "", "word_count": 0}]

        chunk_len = sr * 30
        step = sr * 28
        tokenizer = processor.tokenizer
        blank_id = tokenizer.pad_token_id or 109

        all_words: List[Tuple[float, str]] = []

        for start_idx in range(0, len(audio_data), step):
            end_idx = min(start_idx + chunk_len, len(audio_data))
            chunk = audio_data[start_idx:end_idx]
            if len(chunk) < sr * 2:
                break
            input_tensor = torch.tensor(chunk, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.inference_mode():
                out = model(input_tensor)
                logits = out.logits[0] if hasattr(out, "logits") else (out["logits"][0] if isinstance(out, dict) else (out[0][0] if isinstance(out, (tuple, list)) else out[0]))
            pred_ids = torch.argmax(logits, dim=-1).tolist()

            recognized = []
            for t, tok_id in enumerate(pred_ids):
                if tok_id != blank_id and (not recognized or recognized[-1][1] != tok_id):
                    char = tokenizer.convert_ids_to_tokens(tok_id)
                    sec = (start_idx / float(sr)) + (t * 0.02)
                    recognized.append((sec, tok_id, char))

            cur_word = ""
            cur_start = 0.0
            for sec, tok_id, char in recognized:
                if char == "|" or tok_id == 46:
                    if cur_word.strip():
                        if not all_words or cur_start > all_words[-1][0] + 0.3:
                            all_words.append((round(cur_start, 2), cur_word.strip()))
                        cur_word = ""
                else:
                    if not cur_word:
                        cur_start = sec
                    cur_word += char
            if cur_word.strip():
                if not all_words or cur_start > all_words[-1][0] + 0.3:
                    all_words.append((round(cur_start, 2), cur_word.strip()))

        if not all_words:
            return [{"start_sec": 0.0, "end_sec": total_dur, "duration": total_dur, "text": "", "word_count": 0}]

        # Cluster words into vocal blocks separated by musical interludes (> min_gap_sec)
        raw_blocks: List[List[Tuple[float, str]]] = []
        cur_block: List[Tuple[float, str]] = []
        for w in all_words:
            if not cur_block:
                cur_block.append(w)
            else:
                if w[0] - cur_block[-1][0] > min_gap_sec:
                    raw_blocks.append(cur_block)
                    cur_block = [w]
                else:
                    cur_block.append(w)
        if cur_block:
            raw_blocks.append(cur_block)

        # Filter out noise bursts (< min_block_words)
        valid_blocks = [b for b in raw_blocks if len(b) >= min_block_words]
        if not valid_blocks:
            return [{"start_sec": 0.0, "end_sec": total_dur, "duration": total_dur, "text": "", "word_count": 0}]

        sections: List[Dict[str, Any]] = []
        for b in valid_blocks:
            s_sec = max(0.0, round(b[0][0] - 0.6, 2))
            e_sec = min(total_dur, round(b[-1][0] + 1.8, 2))
            text = " ".join([w[1] for w in b])
            sections.append({
                "start_sec": s_sec,
                "end_sec": e_sec,
                "duration": round(e_sec - s_sec, 2),
                "text": text,
                "word_count": len(b)
            })

        logger.info(f"[MacroAligner] Neural detection found {len(sections)} vocal sections across {total_dur:.1f}s track.")
        return sections

    @staticmethod
    def find_optimal_line_partition(
        raw_lines: List[str],
        section_texts: List[str],
        sections: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[List[List[int]], float]:
        """
        Partitions M lines into K contiguous section groups using dynamic programming.
        Balances text similarity overlap with acoustic capacity (word count & duration).
        Returns: (partitions, total_matching_score)
        """
        K = len(section_texts)
        M = len(raw_lines)
        if K <= 1 or M < K:
            return [list(range(M))], 0.0

        line_word_counts = [len(l.split()) for l in raw_lines]
        total_ref_words = sum(line_word_counts)

        # Compute target words per section for capacity pacing
        if sections and len(sections) == K:
            total_dur = max(0.1, sum(s.get("duration", 1.0) for s in sections))
            total_words = max(1, sum(s.get("word_count", 1) for s in sections))

            sec_expected_words = []
            for s in sections:
                dur_ratio = s.get("duration", 1.0) / total_dur
                word_ratio = s.get("word_count", 1) / total_words
                combined_ratio = 0.5 * dur_ratio + 0.5 * word_ratio
                sec_expected_words.append(combined_ratio * total_ref_words)
        else:
            sec_expected_words = [total_ref_words / K] * K

        cum_words = [0]
        for w_cnt in line_word_counts:
            cum_words.append(cum_words[-1] + w_cnt)

        # Build similarity matrix: similarity between line l and section k
        scores = []
        for l in raw_lines:
            l_text = l.lower()
            l_words = set(l_text.split())
            line_scores = []
            for s_text in section_texts:
                s_words = set(s_text.lower().split())
                overlap = len(l_words.intersection(s_words))
                ratio = difflib.SequenceMatcher(None, l_text, s_text).ratio()
                combined = overlap * 3.0 + ratio * 2.0
                line_scores.append(combined)
            scores.append(line_scores)

        # Dynamic Programming: dp[k, m] assigns first m lines to first k sections
        dp = [[-1e9] * (M + 1) for _ in range(K + 1)]
        parent = [[0] * (M + 1) for _ in range(K + 1)]
        dp[0][0] = 0.0

        for k in range(1, K + 1):
            target_words = sec_expected_words[k - 1]
            s_lead_words = " ".join(section_texts[k - 1].lower().split()[:6])
            for m in range(k, M + 1):
                for p in range(k - 1, m):
                    seg_words = cum_words[m] - cum_words[p]
                    word_ratio = seg_words / max(1.0, target_words)
                    num_lines_in_seg = m - p
                    
                    # Pacing cost: quadratic penalty for deviating from section word capacity
                    capacity_cost = 200.0 * (word_ratio - 1.0) ** 2

                    # Text similarity score
                    text_score = sum(scores[i][k - 1] for i in range(p, m))

                    # Boundary anchor bonus: does the first line of section match the start of section audio?
                    lead_ratio = difflib.SequenceMatcher(None, raw_lines[p].lower(), s_lead_words).ratio()
                    boundary_bonus = lead_ratio * 15.0

                    # Musicological Strophe Bonus: Musical verses & choruses naturally form 4-line stanzas
                    strophe_bonus = 10.0 if (num_lines_in_seg % 4 == 0 and num_lines_in_seg >= 4) else (4.0 if num_lines_in_seg % 2 == 0 else 0.0)

                    total_val = dp[k - 1][p] + text_score + boundary_bonus + strophe_bonus - capacity_cost
                    if total_val > dp[k][m]:
                        dp[k][m] = total_val
                        parent[k][m] = p


        # Backtrack partition
        partitions = []
        curr = M
        for k in range(K, 0, -1):
            p = parent[k][curr]
            partitions.append(list(range(p, curr)))
            curr = p
        partitions.reverse()

        return partitions, float(dp[K][M])

