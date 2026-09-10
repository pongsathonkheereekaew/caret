# M4 evidence — worktree-isolated runs (2026-09-10)

Keeper suite: `apps/caret-daemon/src/worktree.test.ts` — **4/4 pass**,
real git in tmpdir, no mocks.

## What was built

`apps/caret-daemon/src/worktree.ts`: `createIsolatedRun` (detached HEAD in
tmpdir, never inside the repo), `worktreeStatus`, `worktreeDiff` (tracked
patch + new-file sections), `bringBackRun` (overlap refusal + 3way apply +
new-file copy with collision refusal), `removeIsolatedRun` (refuses when
dirty), `listIsolatedRuns` (porcelain, no directory scan).

Proven: main checkout untouched by worktree writes; clean bring-back lands;
overlapping dirty main files refuse with user content preserved; dirty
worktree removal refuses; cleanup removes + prunes.

## Reuse decision (assessed, not imported)

Upstream `managedWorktrees.ts` couples retention to orchestration thread
archival (`ProjectionSnapshotQuery`, thread refs) — adopting it drags the
orchestrator into the daemon boundary. Rebuilt thin (172 lines) over
`GitCore`; seam unchanged. `DEPS.md` updated accordingly (next edit).

## Bugs the keeper suite caught (all fixed)

1. **`Layer.provide` hides provider outputs.** Merging `GitCoreLive` beside
   `NodeServices` does NOT expose FileSystem/Path to consumers — providers
   you yield directly must be MERGED. This would have broken production
   `worktreeDiff`/`bringBackRun` the same way. Fixed in both daemon and test
   layers (upstream `GitCore.test.ts` idiom: feed each live layer + merge
   NodeServices at top).
2. **`git diff` is blind to untracked files.** Review/bring-back now handle
   agent-created files explicitly (preview sections; copy-if-absent).
3. smol API deltas vs classic Effect: no `fork`→`forkScoped`, no
   `Effect.either`→`Effect.exit`, no `catchAll`→`catch`, yield tags as
   `Ns.Tag` never bare namespaces.

## Open M4 tail

Daemon session→worktree binding (runs still take explicit repoDir; default
to isolated worktree per run), setup hooks (OS-specific), retention cap,
extension UI (worktree picker/bring-back review), MCP client (separate track).
