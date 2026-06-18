# Codex Prompt: mf-test

> Converted from Claude command `mf-test.md`. Copy/paste this prompt into Codex when needed.

---

Chạy test cho layer đang làm. Xuất PASS hoặc FAIL.

**Đối số:** `$ARGUMENTS` — layer cụ thể (backend/web/mobile), hoặc để trống để tự detect.

---

**Bước 1 — Detect layer từ file đã thay đổi**
```bash
git diff --name-only HEAD
```

**Bước 2 — Chạy test theo layer**

**Backend:**
```bash
cd musicflow_backend && npm test
```

**Web:**
```bash
cd musicflow_web && npm run lint
```

**Mobile:**
```bash
cd musicflow_app && flutter analyze && flutter test
```

**Bước 3 — Xuất kết quả**
```
## TEST REPORT

| Check | Kết quả |
|-------|---------|
| Lint  | PASS/FAIL |
| Tests | PASS/FAIL |

PASS / FAIL
```
