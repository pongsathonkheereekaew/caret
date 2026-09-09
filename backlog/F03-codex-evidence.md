# F03 evidence — Codex path (2026-09-10)

- CLI: `codex-cli 0.153.4` (`~/.local/bin/codex`)
- Auth: `codex login status` → `Logged in using ChatGPT` (read-only check,
  no credentials read or stored by Caret).
- Bounded live probe (scratch dir `/tmp/caret-f03-probe`, NOT a repo):
  `codex exec --sandbox read-only --skip-git-repo-check --json "List …"`.
  - Note: first attempt without `--skip-git-repo-check` refused correctly
    (`Not inside a trusted directory`) — trust boundary holds.
  - Result: exit 0 in 21s. JSONL event stream observed:
    `turn.started` → `agent_message` → `command_execution` (`ls -1 …`,
    exit 0, correct output `note.txt`, `stderr.log`) → `turn.completed`
    with token usage (`input_tokens 135438 / cached 67441 / output 280`).
  - Sandbox held: only a read command executed; nothing created/modified.
- Conclusion: Codex provider path is **ready** (streaming, tool calls,
  auth isolation). Remaining Codex-side F03 items (cancel/resume mid-turn,
  rate-limit mapping, secret redaction in OUR logs) move to the Synara-driver
  trace (F02 runtime gates in `backlog/F02-backend-adr.md`).

## Still gated (need user at F03 execution)

- OpenCode CLI installed (`1.18.30`) but NO auth yet: OpenCode Go login and/or
  OpenRouter API key have not been provided. Do not invent; ask when the
  OpenCode-driver trace starts.
- No provider keys in process env (verified absent) — as required.
