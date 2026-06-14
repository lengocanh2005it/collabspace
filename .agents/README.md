# Codex skills (mirror)

**Canonical agent docs live in `.claude/`** — shared by Claude Code and Cursor.

This folder exists for **OpenAI Codex** skill discovery:

| Path | Role |
|------|------|
| `.agents/skills/*/SKILL.md` | Codex invocable skills — **mirror** of `.claude/skills/` |
| `.claude/docs/` | Shared reference docs (read from skills) |
| `.claude/rules/` | Path-scoped rules (Claude/Cursor auto-load) |
| `.claude/agents/` | Claude/Cursor subagent definitions (Markdown) |
| `.codex/agents/*.toml` | Codex subagent definitions (TOML) |

## Entry points by tool

| Tool | Start here |
|------|------------|
| Claude Code / Cursor | `CLAUDE.md` → `AGENTS.md` → `.claude/docs/agent-onboarding.md` |
| Codex | `AGENTS.md` → skills in `.agents/skills/` (paths point to `.claude/docs/`) |

## Maintenance

After editing `.claude/skills/*/SKILL.md`:

```sh
bash scripts/sync-agent-docs.sh
# or
pwsh scripts/sync-agent-docs.ps1
```

After editing `.claude/agents/*.md` subagent prompts, update the matching `.codex/agents/*.toml` `developer_instructions` (no auto-sync yet).

Do **not** create `.Codex/docs/` — that path was removed; all shared docs stay in `.claude/docs/`.
