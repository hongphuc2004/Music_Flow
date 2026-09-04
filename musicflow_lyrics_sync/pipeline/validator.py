"""
validator.py — Objective Quality Validation for Aligned Lyrics
Evaluates physical boundaries, acoustic confidence, and consistency without fake heuristics.
"""

from typing import Any, Dict, List, Tuple

def validate_alignment_quality(
    synced_lines: List[Dict[str, Any]],
    plain_lyrics: str,
    audio_duration_sec: float
) -> Tuple[str, List[str]]:
    """
    Performs objective mathematical and acoustic validation on aligned lines and words.
    Returns: (quality_status, quality_notes)
    quality_status: 'GOOD' | 'WARNING' | 'FAILED'
    """
    quality_notes = []
    has_warning = False
    has_failure = False

    if not synced_lines or len(synced_lines) == 0:
        return "FAILED", ["EMPTY_ALIGNMENT_OUTPUT: Không có dòng lời bài hát nào được căn nhịp"]

    expected_lines = [l.strip() for l in plain_lyrics.splitlines() if l.strip()]
    if len(synced_lines) != len(expected_lines):
        quality_notes.append(f"LINE_COUNT_MISMATCH: Đầu vào {len(expected_lines)} dòng, kết quả {len(synced_lines)} dòng")
        has_warning = True

    prev_line_start = -0.01
    total_words_aligned = 0
    all_confidences = []

    for l_idx, line in enumerate(synced_lines):
        l_start = line["startTime"]
        l_end = line["endTime"]

        # 1. Line Boundary & Monotonicity
        if l_start < 0 or l_end < l_start:
            quality_notes.append(f"INVALID_LINE_BOUNDS: Dòng {l_idx + 1} ({l_start}s - {l_end}s)")
            has_failure = True

        if l_start < prev_line_start:
            quality_notes.append(f"LINE_NON_MONOTONIC: Dòng {l_idx + 1} khởi phát trước dòng trước đó")
            has_warning = True
        prev_line_start = l_start

        if l_end > audio_duration_sec + 1.0:
            quality_notes.append(f"LINE_EXCEEDS_AUDIO_DURATION: Dòng {l_idx + 1} ({l_end}s > {audio_duration_sec}s)")
            has_failure = True

        # 2. Word-level Sanity
        words = line.get("words", [])
        prev_word_start = -0.01

        for w_idx, w in enumerate(words):
            total_words_aligned += 1
            w_start = w["startTime"]
            w_end = w["endTime"]
            w_dur = w_end - w_start
            w_conf = w.get("confidence")
            if w_conf is not None:
                all_confidences.append(float(w_conf))

            if w_start < 0 or w_end <= w_start:
                quality_notes.append(f"INVALID_WORD_BOUNDS: Từ '{w['text']}' tại dòng {l_idx + 1}")
                has_failure = True

            if w_start < prev_word_start:
                quality_notes.append(f"WORD_NON_MONOTONIC: Từ '{w['text']}' tại dòng {l_idx + 1}")
                has_warning = True
            prev_word_start = w_start

            if w_dur < 0.03:
                quality_notes.append(f"ABNORMAL_SHORT_WORD: Từ '{w['text']}' có trường độ {round(w_dur * 1000)}ms < 30ms")
                has_warning = True
            elif w_dur > 8.0:
                quality_notes.append(f"ABNORMAL_LONG_WORD: Từ '{w['text']}' có trường độ {round(w_dur, 2)}s > 8s")
                has_warning = True

    # 3. Acoustic Confidence Score Analysis
    if all_confidences:
        mean_conf = sum(all_confidences) / len(all_confidences)
        low_conf_words = [c for c in all_confidences if c < 0.35]
        low_conf_ratio = len(low_conf_words) / len(all_confidences)

        if mean_conf < 0.40 or low_conf_ratio > 0.40:
            quality_notes.append(f"LOW_ACOUSTIC_CONFIDENCE: Độ tin cậy trung bình {round(mean_conf * 100)}%, {round(low_conf_ratio * 100)}% từ có độ tin cậy thấp")
            has_warning = True

    # 4. Overall Coverage
    input_word_count = sum(len(l.split()) for l in expected_lines)
    if input_word_count > 0:
        coverage_pct = float(total_words_aligned) / float(input_word_count)
        if coverage_pct < 0.8:
            quality_notes.append(f"LOW_LYRICS_COVERAGE: Chỉ căn nhịp được {total_words_aligned}/{input_word_count} từ ({round(coverage_pct * 100)}%)")
            has_failure = True

    if has_failure:
        return "FAILED", quality_notes
    if has_warning:
        return "WARNING", quality_notes

    return "GOOD", ["Căn nhịp âm học CTC hoàn chỉnh, 100% mốc thời gian hợp lệ"]
