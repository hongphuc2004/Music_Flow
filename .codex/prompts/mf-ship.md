# Codex Prompt: mf-ship

> Converted from Claude command `mf-ship.md`. Copy/paste this prompt into Codex when needed.

---

Push branch và tạo Pull Request. Chỉ chạy sau khi `/mf-reviewcode` PASS.

**Đối số:** `$ARGUMENTS` — mô tả ngắn (dùng cho PR title)

---

**Bước 1 — Kiểm tra cuối**
```bash
git status
git log main...HEAD --oneline
```

**Bước 2 — Commit nếu chưa**
```bash
git add -p
git commit -m "feat: $ARGUMENTS"
# hoặc fix: / refactor: / chore:
```

**Bước 3 — Push branch**
```bash
git push origin HEAD
```

**Bước 4 — Tạo PR**
```bash
gh pr create \
  --title "feat: $ARGUMENTS" \
  --body "## Thay đổi\n\n- ...\n\n## Test\n\n- [ ] Chạy local thành công" \
  --base main
```
