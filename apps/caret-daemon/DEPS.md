# @caret/daemon — upstream seam (pinned Synara `59db80a`)

This package is Caret-owned. It may import ONLY the modules below from the
adopted stack. Everything else Caret needs must be built here, never reached
around.

## Allowed imports (source-level adapt, interim topology)

- `../../server/src/provider/Services/CodexAdapter.ts` — `CodexAdapter` tag
- `../../server/src/provider/Layers/CodexAdapter.ts` — `makeCodexAdapterLive`
- `../../server/src/checkpointing/Services/CheckpointStore.ts` — tag
- `../../server/src/checkpointing/Layers/CheckpointStore.ts` — `CheckpointStoreLive`
- `../../server/src/git/Layers/GitCore.ts` — `GitCoreLive`
- `../../server/src/config.ts` — `ServerConfig.layerTest` (test config only
  until our own config service exists at H04)
- `@synara/contracts` — ThreadId, CheckpointRef, decision literals
- `@synara/shared` — process/env utilities only
- `effect`, `@effect/platform-node` — same catalog revision as upstream

## Declined (built instead)

- `managedWorktrees.ts` / `workspace/managedWorktree.ts` — retention coupled
  to orchestration thread archival; rebuilt thin in `src/worktree.ts` over
  `GitCore` (WT-01…03/05, 4/4 keeper tests). `CheckpointStore` capture/diff/
  reverse primitives ARE reused (scoped undo proven in F04).

## Forbidden

- `apps/web/*` (UI is Caret's, SYN-02), `apps/desktop/*` (Electron host),
  orchestration reactors directly (go through adapter + store), any
  `*.test.ts` harness, vitest `vi` mocks.

## Exit plan

Wire-protocol facade (Caret API v1, J5) replaces the source seam when native
clients need it (H10). Until then the seam is the directory boundary +
this file. Any import added here requires an ADR line.
