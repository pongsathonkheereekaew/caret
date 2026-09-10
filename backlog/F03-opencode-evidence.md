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
  `thread.started`, `turn.started{model}`. Permission/error event surface
  (`request.opened`, `runtime.error`) confirmed present in adapter code and
  unit-tested (115/115), but NOT exercised live (see gate).

## BILLING GATE (blocks live OpenCode inference)

Turn failed immediately with provider verbatim:
`turn.completed{state: "failed", errorMessage: "Insufficient balance. …/billing"}`
(statusCode 401, non-retryable). The Zen credential has no balance.
Error mapping works correctly (clean `runtime.error`, no hang, no fake
success) — but NO approval/permission roundtrip could be observed because
the model never ran.

Per G-AUTH-01: quota exhausted → stop. No top-up, no silent reroute to a
billed path. Awaiting user: top up Zen, add a funded provider
(OpenRouter/Go via `opencode auth login`), or defer the OpenCode driver.
