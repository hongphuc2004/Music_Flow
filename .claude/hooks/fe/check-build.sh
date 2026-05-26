#!/bin/bash
# Hook: After editing .js/.jsx files, run ESLint if configured

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then exit 0; fi

if echo "$FILE_PATH" | grep -qE '/(node_modules|dist|build)/'; then exit 0; fi

# Tìm thư mục chứa package.json + eslint config từ file đang edit
DIR=$(dirname "$FILE_PATH")
PKG_DIR=""

while [[ "$DIR" != "/" && "$DIR" != "." ]]; do
  if [[ -f "$DIR/package.json" ]] && [[ -f "$DIR/eslint.config.js" || -f "$DIR/.eslintrc.js" || -f "$DIR/.eslintrc.json" ]]; then
    PKG_DIR="$DIR"
    break
  fi
  DIR=$(dirname "$DIR")
done

if [[ -z "$PKG_DIR" ]]; then exit 0; fi
if [[ ! -d "$PKG_DIR/node_modules" ]]; then exit 0; fi

cd "$PKG_DIR" || exit 0

OUTPUT=$(npx eslint "$FILE_PATH" --no-error-on-unmatched-pattern 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "ESLint errors in $FILE_PATH:" >&2
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
