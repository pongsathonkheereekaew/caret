# H05 evidence — R04 vertical slice PASS (2026-09-10)

Daemon: `apps/caret-daemon` in upstream checkout (pinned `59db80a`;
upstream tree otherwise pristine except `bun.lock` linking our package).
Engine: real Codex app-server (ChatGPT). Repo: scratch git `/tmp/caret-slice-1`.
Wall time 22s, both turns on first attempt (second run; first run caught a
newline-strict assertion, fixed to trim-compare).

## Steps (all PASS)

1. `open-repo+session` — native thread live
2. `prompt+turn` — `turn.completed{state: completed}`
3. `approval-surfaced` — `command_execution_approval` with full command
   (`/bin/zsh -lc "printf 'hi slice' > hello.txt"`) shown BEFORE execution,
   explicitly accepted by the driver
4. `edit-applied` — `hello.txt` == "hi slice"
5. `review-diff` — `diffCheckpoints(pre, post)` names the file + content
6. `reject-run` — `reverseCheckpointDiff` removed `hello.txt`, `base.txt` intact
7. `resume-run` — same thread, second goal (`hello2.txt`) approved + applied;
   rejected file stayed gone

Plus: 60-event JSONL journal (`session.state.changed`, deltas, approvals,
resolutions) — the J5 event-journal seed.

## Follow-ups (non-blocking)

- `event.unmapped{nativeType: session/threadOpenResolved}` in journal —
  adapter drops a native lifecycle event; map or explicitly ignore at H04.
- Daemon lives in the upstream checkout behind `DEPS.md` seam (interim
  topology per ADR-001); wire-protocol facade at H10, vendor-out at release.
- Extension surface (composer webview, approval UI, diff review in the fork)
  is the next slice layer — backbone proven here first.
