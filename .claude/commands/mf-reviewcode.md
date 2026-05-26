Review code hiện tại trước khi ship. Xuất kết quả PASS hoặc FAIL.

---

**Bước 1 — Lấy diff**
```bash
git diff main...HEAD
```

**Bước 2 — Check theo layer**

**Backend (.js):**
- [ ] Mọi controller có `try/catch`
- [ ] Response format đúng: `{ success: true/false, data/message }`
- [ ] Không hardcode URL hay secret
- [ ] `async/await` đúng, không callback hell

**Web (.jsx):**
- [ ] Không gọi `axios.*` trực tiếp trong component — phải qua `src/services/api.js`
- [ ] Không có `console.log` sót lại
- [ ] Không hardcode URL — dùng `import.meta.env.VITE_API_URL`
- [ ] Không tạo Axios instance mới

**Mobile (.dart):**
- [ ] Token lưu bằng `flutter_secure_storage`, không `SharedPreferences`
- [ ] HTTP qua `data/services/` — không gọi `http.get` trong widget
- [ ] Không hardcode URL — dùng `ApiConfig.baseUrl`

**Bước 3 — Xuất kết quả**
```
## CODE REVIEW — [branch]

### KẾT QUẢ
🔴 Critical: ...
🟡 Warning: ...
✅ Pass: ...

### KẾT LUẬN
PASS / FAIL
```

Nếu FAIL → sửa Critical → chạy lại `/mf-reviewcode`.
