# Codex Prompt: mf-reviewpr

> Converted from Claude command `mf-reviewpr.md`. Copy/paste this prompt into Codex when needed.

---

Review Pull Request. Xuất APPROVE hoặc REQUEST CHANGES.

**Đối số:** `$ARGUMENTS` — PR number hoặc URL

---

**Bước 1 — Lấy diff**
```bash
gh pr diff $ARGUMENTS
gh pr view $ARGUMENTS --json title,body,files
```

**Bước 2 — Checklist**

**Backend:**
- [ ] Không hardcode secret / URL
- [ ] Route mới đã mount trong `src/server.js`
- [ ] Response format đúng chuẩn `{ success, data/message }`

**Web:**
- [ ] Không API call trực tiếp trong component
- [ ] Không `console.log` sót
- [ ] Route mới đã thêm vào `App.jsx` với đúng ProtectedRoute

**Mobile:**
- [ ] Token không lưu trong `SharedPreferences`
- [ ] Không URL hardcode

**Bước 3 — Xuất kết quả**
```
## PR REVIEW — #$ARGUMENTS

### PHÂN TÍCH
🔴 Critical: ...
🟡 Warning: ...
✅ Pass: ...

### KẾT LUẬN
APPROVE / REQUEST CHANGES
```
