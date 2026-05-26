# Workflow — MusicFlow (Solo Dev)

## Vòng đời một task

```
code → /mf-reviewcode → /mf-ship
```

Không cần plan.md bắt buộc, không cần approve từ ai.

---

## Git

- Branch: `feature/ten-ngan` hoặc `fix/ten-bug`
- Commit: `feat: mô tả` / `fix: mô tả` / `refactor: mô tả` / `chore: mô tả`
- PR vào `main` — có thể self-merge (solo project)
- Không push thẳng vào `main`

---

## Dev commands hàng ngày

```bash
# Backend
cd musicflow_backend
npm run dev        # nodemon src/server.js — hot reload

# Web
cd musicflow_web
npm run dev        # Vite dev server — http://localhost:5173

# Flutter
cd musicflow_app
flutter run        # chọn device
flutter run --dart-define=API_BASE_URL=http://<lan-ip>:5001  # physical device
```

---

## Test

| Layer | Lệnh | Ghi chú |
|-------|------|---------|
| Backend | `npm test` | Nếu có Jest |
| Web | `npm run lint` | ESLint check |
| Flutter | `flutter test` | Widget tests |

---

## Definition of Done

Task xong khi:
1. `/mf-reviewcode` → PASS (không có lỗi nghiêm trọng)
2. Chạy thủ công trên localhost — feature hoạt động đúng
3. PR merge vào `main`

---

## Quy tắc bắt buộc

- Không commit `.env` — chỉ commit `.env.example`
- Không hardcode URL hay secret trong code
- Không push thẳng vào `main` — luôn qua PR
