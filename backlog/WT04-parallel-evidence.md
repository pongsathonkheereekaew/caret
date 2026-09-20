# WT-04 parallel evidence — process isolation PROVEN (2026-09-10)

Daemon: `process-host.ts` (spawn/stop/list/shutdownAll, per-session
port+token+journal) + 3 keepers. Throwaway `/tmp/caret-host-live/`
against TWO real `serve-tcp` daemons.

## Live proof (PROOF-PASS, 22s)

Two daemons spawned (distinct ports/tokens) → two Codex sessions on two
repos → CONCURRENT turns → both `completed` → reviews isolated
(fileA/fileB, no cross-talk) → both stopped, registry drains.

## What this settles

- The earlier stalls were 100% shared-queue routing corruption, NOT a
  provider concurrency limit: same provider, same turns, separate
  processes — everything completes in 22s.
- Per-driver `parallelLiveSessions: false` stands (in-DAEMON sharing is
  still structurally broken); parallelism lives ONE level up, at the
  host. No upstream touch anywhere in this chain.
- `CaretClient`/CLI needed zero changes (per-instance endpoint+token
  already). Extension multi-endpoint wiring rides the UI click track.

## Proven

3/3 host keepers + live parallel proof + full daemon suite (below).
Open: host supervision across restarts, port-range policy, UI endpoint
switcher.
