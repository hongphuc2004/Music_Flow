"""
benchmark_whisper.py — Faster-Whisper Memory & Latency Benchmark Script
Benchmarks Faster-Whisper model sizes (base, small, medium) and compares
word_timestamps=True vs False on Vietnamese audio for MusicFlow.
"""

import argparse
import gc
import os
import sys
import threading
import time
from typing import Any, Dict, List, Optional

import numpy as np
import psutil
import soundfile as sf

_current_dir = os.path.dirname(os.path.abspath(__file__))
_worker_dir = os.path.dirname(_current_dir)
if _worker_dir not in sys.path:
    sys.path.insert(0, _worker_dir)

import config
from pipeline.transcriber import WhisperTranscriberManager, transcribe_audio


class MemoryPeakTracker:
    """Tracks peak memory (RSS in MB) during a code block execution."""
    def __init__(self, interval_sec: float = 0.05):
        self.interval = interval_sec
        self.process = psutil.Process(os.getpid())
        self.peak_mb = 0.0
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def _sample(self):
        while self._running:
            try:
                current_mb = self.process.memory_info().rss / (1024 * 1024)
                if current_mb > self.peak_mb:
                    self.peak_mb = current_mb
            except Exception:
                pass
            time.sleep(self.interval)

    def start(self):
        self.peak_mb = self.process.memory_info().rss / (1024 * 1024)
        self._running = True
        self._thread = threading.Thread(target=self._sample, daemon=True)
        self._thread.start()

    def stop(self) -> float:
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        return round(self.peak_mb, 1)


def generate_synthetic_audio(output_path: str, duration_sec: float = 20.0, sample_rate: int = 16000) -> str:
    """Generates a synthetic 16kHz mono audio file for testing."""
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    # Generate multi-tone harmonics (simulating vocal formants: 220Hz, 440Hz, 880Hz) with silence breaks
    signal = 0.3 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 440 * t) + 0.1 * np.sin(2 * np.pi * 880 * t)
    # Add silence intervals: [0-3s silence intro, 10-13s mid silence]
    signal[: int(sample_rate * 3.0)] = 0.0
    signal[int(sample_rate * 10.0) : int(sample_rate * 13.0)] = 0.0
    sf.write(output_path, signal.astype(np.float32), sample_rate)
    return output_path


def run_benchmark(
    audio_path: str,
    models: List[str],
    test_word_timestamps: bool = True,
) -> List[Dict[str, Any]]:
    # Get audio duration
    info = sf.info(audio_path)
    audio_duration = round(info.duration, 2)

    print("\n" + "=" * 78)
    print(f"🎵 MusicFlow Faster-Whisper ASR Benchmark")
    print(f" • Audio Source: {audio_path}")
    print(f" • Audio Duration: {audio_duration:.2f}s ({audio_duration/60:.2f} mins)")
    print(f" • Sample Rate: {info.samplerate}Hz, Channels: {info.channels}")
    print(f" • Models to evaluate: {', '.join(models)}")
    print(f" • Device: {config.WORKER_DEVICE}, Compute Type: {config.WHISPER_COMPUTE_TYPE}")
    print(f" • CPU Threads limit: {config.WHISPER_CPU_THREADS}")
    print("=" * 78 + "\n")

    results: List[Dict[str, Any]] = []

    for model_name in models:
        ts_options = [False, True] if test_word_timestamps else [config.WHISPER_WORD_TIMESTAMPS]

        for word_ts in ts_options:
            print(f"🚀 Running Benchmark: model='{model_name}', word_timestamps={word_ts}...")

            # Clean memory before run
            gc.collect()
            start_mem_mb = round(psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024), 1)

            tracker = MemoryPeakTracker()
            tracker.start()

            t0 = time.time()
            cpu_before = psutil.cpu_percent(interval=None)

            try:
                res = transcribe_audio(
                    audio_path=audio_path,
                    model_size=model_name,
                    language=config.WHISPER_LANGUAGE,
                    beam_size=config.WHISPER_BEAM_SIZE,
                    word_timestamps=word_ts,
                    vad_filter=config.WHISPER_VAD_FILTER,
                    min_silence_duration_ms=config.WHISPER_VAD_MIN_SILENCE_MS,
                )
                success = True
                error_msg = None
            except Exception as e:
                success = False
                error_msg = str(e)
                res = {}

            latency_sec = round(time.time() - t0, 2)
            peak_mem_mb = tracker.stop()
            cpu_after = psutil.cpu_percent(interval=None)
            rtf = round(latency_sec / max(0.1, audio_duration), 3)

            # Compute word count
            raw_text = res.get("rawTranscript", "")
            words_count = len(raw_text.split()) if raw_text else 0
            segs_count = len(res.get("transcriptionSegments", []))
            metrics = res.get("metrics", {})

            row = {
                "model": model_name,
                "word_timestamps": word_ts,
                "success": success,
                "latency_sec": latency_sec,
                "audio_duration_sec": audio_duration,
                "rtf": rtf,
                "start_mem_mb": start_mem_mb,
                "peak_mem_mb": peak_mem_mb,
                "delta_mem_mb": round(peak_mem_mb - start_mem_mb, 1),
                "segments": segs_count,
                "words": words_count,
                "heuristic_confidence": metrics.get("heuristicConfidence", 0.0),
                "avg_logprob": metrics.get("avgLogProb", 0.0),
                "no_speech_prob": metrics.get("noSpeechProb", 0.0),
                "compression_ratio": metrics.get("compressionRatio", 0.0),
                "sample_text": raw_text[:80] + ("..." if len(raw_text) > 80 else ""),
                "error": error_msg,
            }
            results.append(row)

            print(
                f"   ✅ Done in {latency_sec}s (RTF: {rtf}x) | Peak RAM: {peak_mem_mb} MB "
                f"(Δ {row['delta_mem_mb']} MB) | Segments: {segs_count}, Words: {words_count}"
            )
            if raw_text:
                print(f"   📝 Sample text: \"{row['sample_text']}\"")
            if error_msg:
                print(f"   ❌ Error: {error_msg}")
            print("-" * 65)

    # Print summary Markdown table
    print("\n" + "=" * 78)
    print("📊 BENCHMARK SUMMARY TABLE")
    print("=" * 78)
    headers = [
        "Model",
        "Word TS",
        "Latency (s)",
        "RTF (x)",
        "Peak RAM (MB)",
        "Δ RAM (MB)",
        "Segments",
        "Words",
        "Confidence",
    ]
    header_line = "| " + " | ".join(headers) + " |"
    separator_line = "| " + " | ".join(["---"] * len(headers)) + " |"
    print(header_line)
    print(separator_line)

    for r in results:
        cols = [
            r["model"],
            "True" if r["word_timestamps"] else "False",
            f"{r['latency_sec']}s",
            f"{r['rtf']}x",
            f"{r['peak_mem_mb']} MB",
            f"+{r['delta_mem_mb']} MB",
            str(r["segments"]),
            str(r["words"]),
            str(r["heuristic_confidence"]),
        ]
        print("| " + " | ".join(cols) + " |")
    print("=" * 78 + "\n")

    return results


def main():
    parser = argparse.ArgumentParser(description="Benchmark Faster-Whisper on Vietnamese Audio for MusicFlow")
    parser.add_argument("--audio", type=str, default="", help="Path to input audio file")
    parser.add_argument("--models", type=str, default="base,small", help="Comma-separated models: base,small,medium")
    parser.add_argument("--no-word-ts-compare", action="store_true", help="Skip comparing word_timestamps=False vs True")
    args = parser.parse_args()

    audio_file = args.audio
    if not audio_file or not os.path.exists(audio_file):
        temp_dir = os.path.join(_worker_dir, "temp_bench")
        os.makedirs(temp_dir, exist_ok=True)
        audio_file = os.path.join(temp_dir, "benchmark_sample.wav")
        print(f"[Benchmark] Generating synthetic test audio (20s): {audio_file}")
        generate_synthetic_audio(audio_file, duration_sec=20.0)

    model_list = [m.strip() for m in args.models.split(",") if m.strip()]
    compare_word_ts = not args.no_word_ts_compare

    run_benchmark(audio_file, model_list, test_word_timestamps=compare_word_ts)


if __name__ == "__main__":
    main()
