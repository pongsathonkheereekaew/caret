# Caret — what this extension does today

Caret runs agent turns in an **isolated worktree** (never in your open
folder) behind an **approval gate**: every shell command shows its exact
text BEFORE it runs. Accept executes, Decline leaves nothing behind.

## Composer (Agents view)

- **Send**: prompt → turn runs → status line narrates. **Review** opens the
  worktree diff; **Reject** reverses it (files disappear, base intact);
  **Bring Back** applies the reviewed delta onto your checkout (refuses on
  overlap — resolve first, never forced); **New** starts fresh.
- **Runs…**: lists this folder's isolated runs → remove clean ones.
  Dirty runs refuse with "Review or Reject first".
- **Steer…**: injects follow-up input into the LIVE turn only.
- **Export…**: writes a portable run bundle (`bundle.json`: diff, approvals,
  goal, last 500 events) to a folder you pick. Never overwrites silently.

## Tab completion (local-first)

Ghost text from a local model on your machine; no code leaves it. V1 is
**single-line** (multi-line measured and rejected — it truncated mid-code).
Toggle via status bar, snooze 10 min, per-language disables in settings.
Accept/dismiss follow YOUR keybindings (nothing overridden).
`Cmd/Ctrl+K` (with a selection) = inline edit: proposal → diff → Apply
(atomic, one undo) / Reject / Refine. Drifted buffers get a conflict
choice, never an overwrite.

## Trust posture (deliberate, not bugs)

- The extension stays OFF in untrusted checkouts (an agent that runs
  shell must not auto-run there).
- Bring-back and run removal refuse rather than force; orphans are pruned
  by age, live/dirty work is never deleted.
- Exports refuse to overwrite; handoffs across machines reject tampering
  and OS/arch/node-major drift explicitly.

## Honest limits (2026-09-10)

- Single-line Tab only; no semantic index yet (exact search with
  `.caretignore` only).
- Codex resume-after-stop is unsupported (use a fresh session + handoff);
  OpenCode resumes.
- Remote/second-client runs over a pairing token on your LAN; no cloud,
  no mobile app, no hosted forge — a local Gitea can back PR flows.
- Nothing here auto-updates, signs builds, or syncs anywhere: your code
  stays on your machine unless YOU export or push it.
