# Codex Prompt: mf

> Converted from Claude command `mf.md`. Copy/paste this prompt into Codex when needed.

---

Hiển thị toàn bộ commands của dự án MusicFlow.

---

## MusicFlow Commands

### Dev Workflow

| Command | Khi nào dùng |
|---------|-------------|
| `/mf-task` | Bắt đầu feature/fix — phân tích codebase, code |
| `/mf-reviewcode` | Review code trước khi ship — PASS / FAIL |
| `/mf-test` | Chạy test — PASS / FAIL |
| `/mf-ship` | Push branch + tạo PR |
| `/mf-reviewpr` | Review PR |

**Workflow:**
```
code → /mf-reviewcode → /mf-ship
```

---

### Quy tắc

- Không push thẳng `main` — luôn qua PR
- Không commit `.env` — chỉ `.env.example`
- Branch: `feature/ten-ngan` hoặc `fix/ten-bug`
- Commit: `feat: mô tả` / `fix: mô tả` / `refactor: mô tả`

---

### Dev URLs (local)

| Service | URL |
|---------|-----|
| Backend | http://localhost:5001 |
| Web | http://localhost:5173 |
| MongoDB | mongodb://localhost:27017 |

Gõ bất kỳ command nào ở trên để bắt đầu.
