# Scripts converted from Claude hooks

Claude `PreToolUse` / `PostToolUse` hooks do not run automatically in Codex.
These shell scripts are preserved as manual safety/check scripts.
Run them yourself when needed, or port them to your own Git hooks / CI pipeline.

Suggested usage:
- Run build/lint checks before commit.
- Use protect-sensitive-files checks before staging changes.
- Never rely on these scripts as automatic Codex enforcement.
