# Codex subagents

TOML agent definitions for **OpenAI Codex**. Prompts reference canonical docs in `.claude/docs/`.

| File | Claude/Cursor equivalent |
|------|--------------------------|
| `mvp-implementer.toml` | `.claude/agents/mvp-implementer.md` |
| `nest-reviewer.toml` | `.claude/agents/nest-reviewer.md` |
| `contract-guardian.toml` | `.claude/agents/contract-guardian.md` |

## Skills

Codex loads skills from `.agents/skills/` (mirrors `.claude/skills/`). Run `scripts/sync-agent-docs.sh` after skill changes.

## Maintenance

When you change a subagent in `.claude/agents/*.md`, update the matching `developer_instructions` here. Keep paths as `.claude/docs/...`, not `.Codex/docs/...`.

Cross-tool index: `AGENTS.md`.
