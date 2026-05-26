# Skill: /mf-reviewcode (FE)

## Kích hoạt
`/mf-reviewcode` — review code FE trước khi ship.

---

## Checklist

### Architecture
- [ ] API call qua `src/services/api.js`, không fetch trực tiếp trong component?
- [ ] Không tạo Axios instance mới?
- [ ] File mới đặt đúng chỗ theo cấu trúc `src/`?

### Code Quality
- [ ] Component đặt tên PascalCase?
- [ ] Không hardcode URL, token, config (dùng `import.meta.env.VITE_*`)?
- [ ] Loading và error state được xử lý?
- [ ] Không có `console.log` còn sót lại?

### UI / UX
- [ ] Dùng MUI components — không tự viết CSS từ đầu nếu MUI có sẵn?

### Auth & Security
- [ ] Route mới đã khai báo trong `App.jsx`?
- [ ] Page cần auth đã wrap `ProtectedRoute`?
- [ ] Page có role restriction đã truyền đúng `role` prop?
- [ ] Token không lưu không an toàn?

---

## Output
```
## BÁO CÁO CODE REVIEW — [branch]
### TÓM TẮT
[1–2 câu về trạng thái tổng thể]

### PHÂN TÍCH
🔴 Critical: [file:line] — vấn đề — cách fix
🟡 Warning:  [file:line] — vấn đề — gợi ý
✅ Pass: [tiêu chí đạt]

### KẾT LUẬN
[PASS / FAIL]
```
