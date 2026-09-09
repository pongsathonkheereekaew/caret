# F02 evidence — pre-execution approval control path (2026-09-10)

Driver: Synara `CodexAdapter` at pinned `59db80a`, driven directly via Effect
layers (`makeCodexAdapterLive` + test server config + NodeServices) against
the REAL Codex app-server (ChatGPT subscription, approval-required session,
scratch dir `/tmp/caret-f02-denied`). Spike script was throwaway (deleted
after the run; upstream tree verified clean).

## PASS — decline prevents mutation

Timeline (35s wall):

1. `startSession({ runtimeMode: "approval-required" })` → native thread
   opened via `thread/start`, resolved engine thread id.
2. `sendTurn("Create DENIED-PROOF.txt …")` → streamed `content.delta`s,
   engine attempted the file write.
3. Adapter emitted `request.opened` (~10s in) with a request id.
4. Probe answered `respondToRequest(threadId, requestId, "decline")`.
5. Turn ran to `turn.completed`. **`/tmp/caret-f02-denied/DENIED-PROOF.txt`
   was never created** (`fileExists=false`).

Method note: adapter runtime events carry `type` (`request.opened`,
`turn.completed`, …), not the contract `kind` field — an early probe revision
filtered on `kind` and saw nothing while the engine correctly held
`pendingApprovals=1` at teardown. Fail-closed held even when the consumer was
wrong; fixed filter observed the request immediately.

## What this closes

- H04 core: approval interception happens BEFORE the side effect on the
  Codex path — no facade-after-side-effect. Engine-native request/response
  (`item/*/requestApproval` → `respondToRequest`) is the enforcement point.
- SYN-03 (Codex leg): command → engine → event → projection trace verified
  live: `sendTurn` → deltas → `request.opened` → decline → completion with
  no mutation.
- Unit backing: contracts 11/11, Codex+OpenCode adapters 115/115,
  orchestration core 387/387, gateway protocol/policy 32/32 (all at pinned
  revision, this machine).

## Still open (tracked, not blocking the backend decision)

- Same denial trace on the OpenCode driver → waits on user login
  (OpenCode Go / OpenRouter auth, F03 gate).
- Full-stack trace through WS transport + projection → H05 vertical slice.
- Dirty-buffer reconcile (F04/SYN-04) — separate spike, needs editor bridge.
