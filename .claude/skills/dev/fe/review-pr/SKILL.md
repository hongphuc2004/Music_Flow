# Skill: /mf-reviewpr

## Kích hoạt
`/mf-reviewpr <PR number>` — review PR trước khi approve merge.

---

## Quy trình

1. **Đọc PR** — lấy diff và PR description
   ```bash
   gh pr view <số PR> --json title,body,files
   gh pr diff <số PR>
   ```

2. **Kiểm tra PR description** trước khi đọc code:
   - [ ] Mô tả thay đổi rõ ràng?
   - [ ] Checklist test đã được tích?

3. **Chạy checklist code**

---

## Checklist

### Backend
- [ ] Không hardcode secret / URL
- [ ] Route mới đã mount trong `src/server.js`
- [ ] Response format đúng chuẩn `{ success, data/message }`
- [ ] try/catch trong mọi controller

### Web
- [ ] Không API call trực tiếp trong component
- [ ] Không `console.log` sót
- [ ] Route mới đã thêm vào `App.jsx` với đúng ProtectedRoute

### Mobile
- [ ] Token không lưu trong `SharedPreferences`
- [ ] Không URL hardcode — dùng `ApiConfig.baseUrl`

### Conflict
- [ ] Branch không có conflict với `main`?

---

## Output
```
## BÁO CÁO PR REVIEW — #<số PR> — [YYYY-MM-DD]

### PHÂN TÍCH
🔴 Critical: [file:line] — vấn đề — cách fix
🟡 Warning:  [file:line] — vấn đề — gợi ý
✅ Pass: [tiêu chí đạt]

### KẾT LUẬN
[APPROVE / REQUEST CHANGES]
```
