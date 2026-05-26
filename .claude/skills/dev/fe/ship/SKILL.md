# Skill: /mf-ship

## Kích hoạt
`/mf-ship <mô tả ngắn>` — tạo PR sau khi `/mf-reviewcode` PASS.

---

## Quy trình

1. **Kiểm tra cuối**
   ```bash
   git status && git log main...HEAD --oneline
   ```
   Không có: `.env`, `node_modules`, file build (`dist/`)

2. **Commit nếu chưa**
   ```bash
   git add -p
   git commit -m "feat: <mô tả>"
   ```

3. **Push branch**
   ```bash
   git push origin HEAD
   ```

4. **Tạo PR**
   ```bash
   gh pr create \
     --title "feat: <mô tả>" \
     --body "## Thay đổi\n- \n\n## Test\n- [ ] Chạy được trên localhost\n- [ ] Không break tính năng khác" \
     --base main
   ```

---

## Không được
- Merge PR của chính mình
- Force push sau khi PR đã mở
- Ship khi chưa chạy `/mf-reviewcode` PASS
