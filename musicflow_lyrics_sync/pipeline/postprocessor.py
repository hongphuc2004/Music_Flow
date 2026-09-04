"""
postprocessor.py — Energy Tail Extension and Line/Word LRC Compiler
"""

import os
import numpy as np
import soundfile as sf
from typing import List, Dict, Any, Tuple

def format_lrc_timestamp(seconds: float) -> str:
    """Format seconds into standard [mm:ss.xx] LRC timestamp."""
    total_sec = max(0.0, float(seconds))
    mins = int(total_sec // 60)
    secs = int(total_sec % 60)
    centi = int(round((total_sec - int(total_sec)) * 100))
    if centi >= 100:
        secs += 1
        centi = 0
    return f"[{mins:02d}:{secs:02d}.{centi:02d}]"

def apply_energy_tail_extension(
    vocals_wav_path: str,
    raw_words: List[Dict[str, Any]],
    audio_duration_sec: float,
    max_tail_sec: float = 1.2,
    energy_threshold_db: float = -35.0,
    enable_word_bridging: bool = True,
    bridging_gap_threshold_sec: float = 0.08,
) -> List[Dict[str, Any]]:
    """
    Scans acoustic energy forward from raw_end to extend decaying vocal tails (melisma/long vowels).
    Applies adaptive noise floor and word bridging (< 80ms) for smooth karaoke rendering.
    Preserves audit fields: rawStartTime, rawEndTime, startTime, endTime, tailExtensionAppliedSec.
    """
    # Load vocals waveform for RMS measurement
    data = None
    sr = 16000
    peak_amp = 1.0
    effective_thresh_db = energy_threshold_db

    if vocals_wav_path and os.path.exists(vocals_wav_path):
        try:
            data, sr = sf.read(vocals_wav_path, dtype="float32")
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            peak_amp = float(np.max(np.abs(data))) + 1e-12
            # Adaptive noise floor estimation
            step = max(1, len(data) // 1000)
            sample_blocks = data[::step]
            block_rms = np.sqrt(np.mean(sample_blocks ** 2) + 1e-12)
            floor_db = 20 * np.log10((block_rms + 1e-12) / peak_amp)
            # Adapt threshold: at least 6dB above noise floor, bounded between -42dB and -28dB
            effective_thresh_db = max(-42.0, min(-28.0, max(energy_threshold_db, floor_db + 6.0)))
        except Exception:
            data, sr, peak_amp = None, 16000, 1.0

    processed_words = []
    num_words = len(raw_words)

    for i, w in enumerate(raw_words):
        raw_s = float(w["raw_start"])
        raw_e = float(w["raw_end"])
        w_dur = raw_e - raw_s
        next_w_s = float(raw_words[i + 1]["raw_start"]) if i + 1 < num_words else audio_duration_sec

        final_s = raw_s
        final_e = raw_e
        extension_sec = 0.0

        is_line_end = (i == num_words - 1) or (raw_words[i + 1]["line_index"] != w["line_index"])
        available_gap = max(0.0, next_w_s - raw_e - 0.015) # Leave 15ms safety buffer

        # Eligible if line end OR word has available gap to extend into decaying vowel
        scan_limit = max_tail_sec if is_line_end else min(max_tail_sec * 0.5, 0.4)

        if data is not None and available_gap > 0.04 and scan_limit > 0.04:
            # Scan RMS frames forward from raw_e
            scan_frames = int(min(scan_limit, available_gap) * sr)
            start_sample = int(raw_e * sr)
            end_sample = min(len(data), start_sample + scan_frames)

            if end_sample > start_sample:
                segment = data[start_sample:end_sample]
                # Measure 25ms sub-blocks for finer granularity
                block_size = int(sr * 0.025)
                extended_samples = 0

                for b_start in range(0, len(segment), block_size):
                    block = segment[b_start:b_start + block_size]
                    rms = np.sqrt(np.mean(block ** 2) + 1e-12)
                    db_rel = 20 * np.log10((rms + 1e-12) / peak_amp)

                    if db_rel >= effective_thresh_db:
                        extended_samples += len(block)
                    else:
                        break

                extension_sec = round(float(extended_samples) / sr, 3)
                final_e = round(min(audio_duration_sec, raw_e + extension_sec), 3)

        # Word Bridging for consecutive words in the SAME line
        if enable_word_bridging and not is_line_end and i + 1 < num_words:
            remaining_gap = next_w_s - final_e
            if 0.0 < remaining_gap <= bridging_gap_threshold_sec:
                # Bridge gap up to 15ms before next word start to prevent visual stutter
                bridged_e = round(next_w_s - 0.015, 3)
                if bridged_e > final_e:
                    extension_sec = round(extension_sec + (bridged_e - final_e), 3)
                    final_e = bridged_e

        # Enforce sanity boundaries
        final_e = max(final_s + 0.05, final_e)
        if i + 1 < num_words and final_e > next_w_s:
            final_e = max(final_s + 0.05, next_w_s - 0.015)

        processed_words.append({
            "line_index": w["line_index"],
            "word_index": w["word_index"],
            "text": w["text"],
            "rawStartTime": raw_s,
            "rawEndTime": raw_e,
            "startTime": final_s,
            "endTime": final_e,
            "tailExtensionAppliedSec": extension_sec,
        })

    return processed_words


def compile_line_and_word_lyrics(
    processed_words: List[Dict[str, Any]],
    plain_lyrics: str,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Groups words into lines, preserving the exact original line structure and text.
    Produces syncedLines structure and valid LRC string.
    """
    raw_lines = [l.strip() for l in plain_lyrics.splitlines() if l.strip()]
    synced_lines = []
    lrc_entries = []

    for line_idx, line_text in enumerate(raw_lines):
        line_words = [w for w in processed_words if w["line_index"] == line_idx]
        if not line_words:
            continue

        line_start = line_words[0]["startTime"]
        line_end = line_words[-1]["endTime"]

        formatted_words = []
        for w in line_words:
            formatted_words.append({
                "text": w["text"],
                "startTime": w["startTime"],
                "endTime": w["endTime"],
                "rawStartTime": w["rawStartTime"],
                "rawEndTime": w["rawEndTime"],
                "tailExtensionAppliedSec": w["tailExtensionAppliedSec"],
            })

        synced_lines.append({
            "lineIndex": line_idx,
            "startTime": line_start,
            "endTime": line_end,
            "text": line_text,
            "words": formatted_words,
        })

        lrc_entries.append(f"{format_lrc_timestamp(line_start)}{line_text}")

    lrc_string = "\n".join(lrc_entries)
    return synced_lines, lrc_string
