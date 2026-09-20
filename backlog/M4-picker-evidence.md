# M4-picker evidence — isolated-run picker + guarded remove (2026-09-10)

Daemon (`caret-adapter` branch): `listCaretRuns` (caret-prefix filter over
`git worktree list`) + `removeWorktreeDir` (path-based remove for runs with
no live handle) in `apps/caret-daemon/src/worktree.ts`, exposed as
`run.list` / `run.remove` RPC in `server.ts` (same `no session` posture as
the other run methods — the picker needs a live session for its repoDir).

## Guard order (the safety case, all keeper-tested)

Canonicalize (realpath both sides) → refuse main checkout → caret prefix
only → tmp-root only → never the live run's dir → refuse dirty with
`false` (no force on this path; reverse or bring back first). Guard
violations fail with the reason, surfaced in the composer status line.
Unregistered orphan dirs fail loudly at `git worktree remove` (`not a
working tree`) and stay on the prune path (WT-05, proven) — never rm -rf'd
here. Prefix spoofing inside the repo tree still refuses (tmp-root guard
in production; in tmpdir fixtures git is the backstop).

## Proven

- `worktree.test.ts`: 9/9 (6 existing + 3 picker: list-filters-foreign +
  clean-remove-by-path, dirty-refusal, 6-way guard refusal). Full daemon
  suite 14/14 (9 worktree + 5 MCP).
- Extension `tsc -p ./` exit 0; `package.json` + `package.nls.json` parse.

## UI (machine-verified, live click outstanding with H05)

- Composer `Runs…` button + `caret.listRuns` palette command →
  `run.list` QuickPick (basename + full dir) → modal Remove confirm →
  `run.remove`; dirty refusal posts "has unreviewed changes — Review or
  Reject first". Review/bring-back stay on the live session (no
  multi-run registry — deliberate scope cut, single-run daemon unchanged).

## Still open M4 tail

MCP SSE/streamable + OAuth (stdio 5/5 stands), OS-specific setup hooks.
Retention cap closed earlier (prune keepers green).
