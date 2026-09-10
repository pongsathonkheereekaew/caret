# M4-backend evidence — steer, resume matrix, MCP, retention (2026-09-10)

## Steer (AG-05, Codex): PASS

Live turn steered mid-flight: `turn.steered` event observed, all 3 files
contain the injected HEADER line, turn completed normally. Facade:
`steerCaretTurn` (daemon.ts). First attempt timed out only because a 3-file
multi-approval turn needs >200s — deadline is now configurable per call.

## Resume (AG-06): per-driver truth, not a uniform claim

- **Codex: resume-after-stop UNSUPPORTED** (`resumeStoppedSession: false` in
  `CODEX_DRIVER_CAPABILITIES`). Root cause, traced to source:
  `stopSession` → `teardownContextProcess` kills the per-session provider
  process. A later `thread/resume` against a fresh child resolves the id but
  `turn/start` stalls forever — no response, no timeout, 7 silent minutes
  observed twice. The failure mode is silence, so the facade declares it
  unsupported rather than letting callers hang.
- **OpenCode: resume-after-stop SUPPORTED** (OCRS-PASS, free tier, 24s):
  start → approval → file → stop → `resumeCursor{openCodeSessionId,cwd}` →
  recall turn named `ocmem.txt` from history, zero new tool calls.
- Continuity across Codex sessions uses **semantic handoff**
  (`summarizeRunForHandoff`: goal, files, approval record, diff — pure
  assembly, no engine call), which doubles as the engine-switch mechanism.

## MCP transport (PX-14 core): 5/5 keeper tests

`mcp.ts` (owned stdio JSON-RPC, no SDK) + fixture server: initialize/version
negotiation, tools list/call, tool-level errors, unknown-tool protocol
errors, cancellation via `notifications/cancelled` (fixed a double-reply
race), timeout, reconnect-after-kill (fixed a stale-exit-handler race that
killed the new session's pending calls). SSE/streamable + OAuth remain open.

## Retention (WT-05): keepers green

`pruneOrphanWorktreeDirs` (unregistered old caret dirs only; live ones
survive via registration check) + `pruneOldRuns` (old + clean removed,
dirty reported, young kept). Full daemon suite: 11/11 (6 worktree + 5 MCP).

## Path canonicalization (real bug fixed)

`/tmp` is a symlink (`/private/tmp`); git reports real paths. Every path
leaving `createIsolatedRun` and every directory compared in prune is
realpath'd — string comparisons (list membership, overlap, prune identity)
were silently broken before, including a near-miss where prune could have
deleted a LIVE worktree.
