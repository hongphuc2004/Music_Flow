"""
onset_snapper.py — High-Precision Acoustic Attack Transient Snapping
Snaps word start times to the nearest acoustic onset transient using spectral flux / energy onset.
"""

import os
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import soundfile as sf

logger = logging.getLogger("AlignmentWorker.OnsetSnapper")


def snap_word_onsets(
    vocals_wav_path: str,
    raw_words: List[Dict[str, Any]],
    sr: int = 16000,
    max_backward_snap_sec: float = 0.08,
    max_forward_snap_sec: float = 0.05,
) -> List[Dict[str, Any]]:
    """
    Refines CTC word raw_start boundaries by snapping to physical acoustic attack transients (onsets).
    Prevents words from starting late (cutting initial consonants) or early (starting in pre-onset silence).
    """
    if not raw_words or not vocals_wav_path or not os.path.exists(vocals_wav_path):
        return raw_words

    try:
        import librosa
    except ImportError:
        logger.warning("[OnsetSnapper] librosa not available, skipping onset snapping.")
        return raw_words

    try:
        data, file_sr = sf.read(vocals_wav_path)
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if file_sr != sr and len(data) > 0:
            data = librosa.resample(data, orig_sr=file_sr, target_sr=sr)
    except Exception as e:
        logger.warning(f"[OnsetSnapper] Failed to read audio for onset snapping: {e}")
        return raw_words

    if len(data) < sr * 0.2: # Audio too short (< 200ms)
        return raw_words

    try:
        # Detect acoustic attack onsets using 10ms hop (160 samples at 16kHz) with backtracking
        onsets = librosa.onset.onset_detect(
            y=data,
            sr=sr,
            hop_length=160,
            units="time",
            backtrack=True,
            pre_max=3,
            post_max=3,
            pre_avg=3,
            post_avg=5,
            delta=0.07,
            wait=4
        )
    except Exception as e:
        logger.warning(f"[OnsetSnapper] Onset detection failed: {e}")
        return raw_words

    if onsets is None or len(onsets) == 0:
        return raw_words

    onset_times = np.array(onsets)
    snapped_words: List[Dict[str, Any]] = []
    prev_end = 0.0

    for i, w in enumerate(raw_words):
        raw_s = float(w["raw_start"])
        raw_e = float(w["raw_end"])

        # Find onsets in window [raw_s - max_backward_snap_sec, raw_s + max_forward_snap_sec]
        win_start = raw_s - max_backward_snap_sec
        win_end = raw_s + max_forward_snap_sec

        candidate_indices = np.where((onset_times >= win_start) & (onset_times <= win_end))[0]

        if len(candidate_indices) > 0:
            # Pick candidate closest to raw_s
            candidates = onset_times[candidate_indices]
            best_onset = candidates[np.argmin(np.abs(candidates - raw_s))]

            # Monotonicity sanity check: do not overlap with previous word
            min_allowed_start = prev_end + 0.015 if i > 0 else 0.0
            snapped_s = round(float(max(min_allowed_start, best_onset)), 3)

            # Ensure start is before end
            if snapped_s < raw_e - 0.03:
                raw_s = snapped_s

        prev_end = raw_e
        word_copy = dict(w)
        word_copy["raw_start"] = raw_s
        word_copy["raw_end"] = raw_e
        snapped_words.append(word_copy)

    return snapped_words
