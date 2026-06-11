---
description: Pet the HUD pet — it reacts with a kawaii face
allowed-tools: Bash
---

Pet the claude-hud statusline pet. Run exactly this command — no preamble, no analysis:

```bash
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/claude-hud"; mkdir -p "$dir"; touch "$dir/pet-touch"
```

Then reply with exactly one line and nothing else:

purr~
