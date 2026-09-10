# M4 retention evidence — count-based run cap DONE (2026-09-10)

Daemon: `pruneRunsBeyondCap` + `DEFAULT_RUN_RETENTION = 20` in `worktree.ts`,
enforced best-effort on `session.stop` (`session-api.ts`). Closes the open
M4 tail item noted in `worktree.ts` ("Retention prune stays an open M4 tail item").

## Keepers (3, real git in tmpdir, no mocks)

- Cap keeps newest N: 4 runs with forced mtimes, keep=2 → oldest 2 removed
  from disk, newest 2 kept, `keptDirty` empty.
- Live + dirty survive: keep=1 with oldest=live dir → live kept (guard
  refuses), dirty run reported in `keptDirty`, both dirs survive on disk.
- Negative keep fails loud (`non-negative integer`).

## Safety case

- Removal reuses `removeWorktreeDir`'s guard chain (canonicalize → main
  checkout → caret prefix → tmp root → live → dirty refusal); guard
  violations are caught per-dir and reported in `kept`, never abort the pass.
- Unstatable dirs are kept — never prune what cannot be inspected.
- `listCaretRuns` no longer returns the main checkout itself (fixture
  `caret-wt-main-*` dirs exposed this; picker-source fix in the same change).
- No new RPC: 13-method contract pin (`remote.test.ts`) untouched; fork
  needs zero changes.

## Proven

3/3 retention keepers + full daemon suite 97/97 + fork untouched.
Open: MCP SSE/OAuth, Tab keybinding, semantic index (D-plan).
