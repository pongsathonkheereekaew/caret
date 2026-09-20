# M4-binding evidence — isolated by default (2026-09-10)

Daemon: sessions now execute in a detached worktree unless explicitly
`{isolate:false}` (scratch only). One live Codex turn, 19s wall.

## Steps (all PASS)

1. `isolated-by-default` — session cwd is `/tmp/caret-wt-bind1- Bud…`, not main
2. Approval surfaced with exact command → accepted
3. `engine-ran-isolated` — file exists in worktree, main has no trace
4. `review-diff` — worktree delta names the file (161 chars)
5. `bring-back` — `run.bringBack` applied onto main; content verified
6. `stop-cleans-worktree` — post-bring-back removal succeeded, dir gone

Plus: `run.bringBack` RPC method + Bring Back webview button (refusal
surfaced as "resolve conflicts first", never forced).

## Lifecycle rule locked

`removeIsolatedRun` refuses dirty worktrees EXCEPT post-bring-back
(`broughtBack` flag): the delta is verified onto main, so removal cannot
lose reviewed work. Reject path still reverses in-worktree (no main touch).

## Fixed along the way

- Unique worktree dirs per run (`runId + timestamp36`): crashed runs leave
  orphan dirs that collide with fixed names (`fatal: already exists`) and
  serialize parallel runs. Orphan prune stays open (retention cap).
- `fail()` now shows error head+tail (the head alone hid this exact bug).
