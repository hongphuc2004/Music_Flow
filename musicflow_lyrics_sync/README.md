---
title: MusicFlow AI Lyrics Alignment Worker
emoji: 🎵
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# 🎵 MusicFlow AI Lyrics Alignment Worker (16GB RAM Production Node)

High-performance Vietnamese neural acoustic forced alignment worker powered by **Wav2Vec2 CTC** (`nguyenvulebinh/wav2vec2-base-vietnamese-250h`), Log-Space Trellis Dynamic Programming, and Viterbi Backtracking.

## 🚀 Environment Variables Required on Hugging Face Space

In your Space **Settings** ➔ **Variables and secrets**, add:

| Name | Type | Value / Description |
| :--- | :--- | :--- |
| `MONGO_URI` | Secret | Your MongoDB Atlas connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/musicflow_db?retryWrites=true&w=majority`) |
| `DATABASE_NAME` | Variable | `musicflow_db` |
| `WORKER_DEVICE` | Variable | `cpu` (or `cuda` if GPU Space) |
| `ENABLE_VOCAL_SEPARATION` | Variable | `false` |
| `PIPELINE_VERSION` | Variable | `3.0.0` |

---

## ⚡ Architecture & Features

- **Zero OOM / 16GB RAM**: Handles 5–7 minute audio tracks effortlessly with multi-threading CPU acceleration.
- **Accurate Word-level Timestamps**: Neural CTC acoustic evidence决定 mốc thời gian từng từ.
- **Auto OCC Concurrency**: Safely synchronizes with MusicFlow Backend & Web Studio.
