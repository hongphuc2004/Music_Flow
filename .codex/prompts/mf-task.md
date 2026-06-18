# Codex Prompt: mf-task

> Converted from Claude command `mf-task.md`. Copy/paste this prompt into Codex when needed.

---

Bắt đầu làm một feature hoặc fix trong MusicFlow.

**Đối số:** `$ARGUMENTS` — mô tả ngắn task (VD: "thêm tính năng share bài hát")

---

**Bước 1 — Xác định layer cần làm**
- Backend (`musicflow_backend/`) → đọc `rules/tech/be.md`
- Web (`musicflow_web/`) → đọc `rules/tech/fe.md`
- Mobile (`musicflow_app/`) → đọc `rules/tech/mobile.md`

**Bước 2 — Phân tích codebase liên quan**
Dùng codegraph hoặc Grep để tìm các file cần đọc trước khi code.

**Bước 3 — Code**
Implement theo đúng conventions của layer đang làm.

**Bước 4 — Tự review nhanh**
Trước khi báo xong: kiểm tra không có `console.log`, không hardcode URL, không gọi API trực tiếp trong component.

**Bước 5 — Chạy `/mf-reviewcode` khi xong**
