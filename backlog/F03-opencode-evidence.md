# F03 evidence — OpenCode path (2026-09-10)

- CLI: `opencode 1.18.30` (`~/.opencode/bin/opencode`).
- Auth: user completed `opencode auth login` → `opencode auth list` shows
  **1 credential: OpenCode Zen api** (`~/.local/share/opencode/auth.json`).
  (Side note: the Sep-5 `opencode.db` unreadable error from the previous
  check is gone — login recreated working state. Untouched by us.)
- Model discovery (live, via Zen credential): `opencode models` returns
  `provider/model` slugs including `opencode/deepseek-v4-flash`,
  `opencode/claude-haiku-4-5`, `opencode/deepseek-v4-pro`, … — DeepSeek IS
  reachable through the OpenCode driver, no separate key needed (closes the
  L8 model-routing question for DeepSeek; quality eval still pending).
- Adapter contract: `OpenCodeAdapter` REQUIRES explicit
  `modelSelection: {provider: "opencode", model: "<provider/model>"}` —
  no silent default (L8 "never guess a model slug" enforced in code).
- Wiring verified live: `startSession({runtimeMode: "approval-required"})`
  → native session `ses_…` → `sendTurn` streams `session.started`,
  `thread.started`, `turn.started{model}` — then exercised live, see PASS.

## PASS — denial trace on free tier (2026-09-10, `opencode/big-pickle`, $0)

Per official Zen docs there is no separate "Go" provider — Zen IS the managed
gateway (Go = the subscription on it); the 401 was that workspace's balance.
Zen's free-tier models (`big-pickle`, `mimo-v2.5-free`, …) run at $0, so the
control-path spike needs no funding:

1. `startSession({runtimeMode: "approval-required"})` → native `ses_…`.
2. `sendTurn("Create DENIED-PROOF.txt …", model opencode/big-pickle)` →
   engine attempted `write` with exact path+content (`item.started/updated`).
3. Adapter emitted `request.opened{file_change_approval}` with the file diff
   attached (~10s in).
4. Probe declined → `request.resolved{decline}` → tool failed
   ("user rejected permission") → **file never created**.
5. Usage reported: 14,949 tokens, $0.

Observation (non-blocking): after the rejected tool the turn ended
`failed: "OpenCode became idle after tool calls without producing a final
assistant response"` — engine quirk, control outcome unaffected. Paid-model
quality evals still need a funded workspace (unchanged).
