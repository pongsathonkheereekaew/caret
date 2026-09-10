# WT-04 sessions evidence — switching proven, parallel refused (2026-09-10)

Daemon (`caret-adapter`): per-thread session map, `session.list`,
optional `session` on all run methods, duplicate-start + refuse-while-
live guards, fiber interrupted on stop, `parallelLiveSessions: false`
capability next to `resumeStoppedSession: false`.

## Root cause found live (the valuable part)

Two live sessions stalled BOTH turns (200s daemon timeouts) while
completions sat journaled but waiters blind. Traced to source:
Codex (`Layers/CodexAdapter.ts:2499`) and OpenCode (`4575`) expose
`Stream.fromQueue` — COMPETING consumers, so a second stream
subscription steals events from the first. Cursor/Devin/Droid/Grok/Pi
adapters use `Stream.fromPubSub` (every subscriber gets everything).
Parallel live sessions on queue-drivers are structurally impossible
without adapter surgery (upstream-owned) — declared, not worked around.

## Enforced model (proven)

One live subscription per daemon: second `session.start` fails
(`another session is live` — observed live), stop interrupts the fiber
(no cross-talk into the next session), sequential switching works:
A start→turn→review→stop→B start→turn→review→stop, 36s, reviews
isolated (fileA/fileB), list drains. Throwaway `/tmp/caret-multi/`.

## Second bug caught en route (mine)

The fiber-capture edit deleted `const seen` → instant `ReferenceError`
on start. Reproduced against a live gateway, restored, suite green.
Lesson recorded: refactors touching the stream closure need the live
start smoke, not just the suite (no keeper covers it — stated openly).

## Proven

Full daemon suite 91/91 (incl. no-engine scoping keepers) + switching
proof PASS. True parallelism tracks: PubSub adapters or one daemon
process per session (not started).
