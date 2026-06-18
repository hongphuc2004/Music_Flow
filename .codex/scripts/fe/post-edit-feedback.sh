#!/bin/bash
# Hook: After editing .js/.jsx files, check for MusicFlow anti-patterns

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Chỉ chạy với .js và .jsx (bỏ qua .ts/.tsx vì project dùng plain JS)
if [[ "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then exit 0; fi

# Bỏ qua node_modules, dist, build
if echo "$FILE_PATH" | grep -qE '/(node_modules|dist|build)/'; then exit 0; fi

if [[ ! -f "$FILE_PATH" ]]; then exit 0; fi

WARNINGS=""

# console.log còn sót lại — bỏ qua dòng comment
if grep -E 'console\.(log|warn|debug)\(' "$FILE_PATH" | grep -qvE '^\s*(//|/?\*)'; then
  WARNINGS="${WARNINGS}⚠️  console.log found in '$FILE_PATH' — remove before shipping.\n"
fi

# Hardcode URL — bỏ qua localhost, test file, comment, biến env
if ! echo "$FILE_PATH" | grep -qE '\.(test|spec)\.(js|jsx)$'; then
  if grep -E '"https?://[^"]*"' "$FILE_PATH" | grep -qvE 'localhost|127\.0\.0\.1|0\.0\.0\.0|^\s*(//|/?\*)|VITE_|example\.com'; then
    WARNINGS="${WARNINGS}⚠️  Hardcoded URL in '$FILE_PATH'. Use import.meta.env.VITE_API_URL.\n"
  fi
fi

# Gọi axios trực tiếp trong component/page — nên qua src/services/api.js
if echo "$FILE_PATH" | grep -qE '/(pages|components|screens)/'; then
  if grep -qE 'axios\.(get|post|put|patch|delete)\s*\(' "$FILE_PATH"; then
    WARNINGS="${WARNINGS}⚠️  Direct axios call in '$FILE_PATH'. Use src/services/api.js instead.\n"
  fi
fi

# Tạo Axios instance mới (ngoài services/api.js)
if grep -qE 'axios\.create\s*\(' "$FILE_PATH"; then
  if ! echo "$FILE_PATH" | grep -q 'services/api'; then
    WARNINGS="${WARNINGS}⚠️  New axios.create() in '$FILE_PATH'. Use src/services/api.js — do not create new instances.\n"
  fi
fi

if [[ -n "$WARNINGS" ]]; then
  echo -e "$WARNINGS"
fi

exit 0
