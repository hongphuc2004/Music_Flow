# Codex Skill Prompt

> Converted from Claude Skill. Use as a manual checklist/prompt in Codex.

---

# Skill: /mf-task

## Kích hoạt
`/mf-task <mô tả task>` — bắt đầu làm feature hoặc fix trong MusicFlow.

---

## Quy trình

### Bước 1 — Xác định layer
- **Backend** (`musicflow_backend/`) → đọc `rules/tech/be.md`
- **Web** (`musicflow_web/`) → đọc `rules/tech/fe.md`
- **Mobile** (`musicflow_app/`) → đọc `rules/tech/mobile.md`

### Bước 2 — Phân tích codebase
Dùng codegraph hoặc Grep để tìm các file liên quan trước khi code.

### Bước 3 — Tạo branch
```bash
git checkout -b feature/ten-tinh-nang
# hoặc
git checkout -b fix/ten-bug
```

### Bước 4 — Implement theo conventions của layer

**Backend:**
- Controller trong `src/controllers/`
- Model trong `src/models/`
- Route trong `src/routes/` + mount trong `src/server.js`
- Response format: `{ success: true/false, data/message }`

**Web:**
- Page trong `src/pages/{role}/`
- API call trong `src/services/api.js`
- Route trong `App.jsx` với `ProtectedRoute`

**Mobile:**
- Screen trong `lib/presentation/screens/`
- API call trong `lib/data/services/`
- Không hardcode URL — dùng `ApiConfig.baseUrl`

### Bước 5 — Tự kiểm tra
- Không còn `console.log`
- Không hardcode URL / secret
- API call đúng layer (không gọi trực tiếp trong component/widget)

### Bước 6 — Chạy `/mf-reviewcode` khi xong

---

## Không được
- Gọi API trực tiếp trong component (phải qua services layer)
- Hardcode URL API
- Thêm package mới mà không xem xét tech stack hiện tại
