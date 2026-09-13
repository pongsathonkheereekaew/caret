# Team onboarding — Caret build/verify map (2026-09-10)

> Archived 10 September 2026. Living rules: [AGENTS.md](../../../AGENTS.md).
> One git repo now; do not recreate three checkouts from this map.

Three checkouts, three branches, one control repo. Read `HANDOFF.md`
first (status + decisions), then this file, then `backlog/`.

## Checkouts (all under `~/caret-work/`, space-free paths — REQUIRED,
## the control repo path contains a space that breaks native builds)

| Checkout | Branch | What lives there | Verify |
|---|---|---|---|
| `caret-desktop` (Code-OSS fork @ `3e078a3`) | `caret` | `extensions/caret/*` (composer UI), `src/vs/workbench/contrib/agentWorkbench/*` (native scaffold) | `node_modules/.bin/tsc -p extensions/caret/` (0); fork-wide `tsc -p src/tsconfig.json --noEmit` (~45s, 0 errors) |
| `upstream-synara/apps/caret-daemon` | `caret-adapter` | entire daemon (`src/*.ts`) | `bun x vitest run apps/caret-daemon/src/` from `upstream-synara` root (currently 91+ green) |
| control repo (this one) | `main` | docs, `backlog/` evidence, `requirement-graph.json` SSOT, `scripts/ci-validate.mjs`, `.github` CI | `node scripts/ci-validate.mjs` + push (self-hosted runner `caret-mac`) |

Toolchain: `~/.caret-tools/node-v24.18.0-darwin-arm64`, `~/.bun` (bun),
`~/.opencode` (CLI), `~/.local/bin/codex`, `~/.caret-models/`
(Qwen coder + nomic embed), `~/caret-work/llama.cpp` (servers).

## Hard-won mechanics (violations broke builds before)

- smol Effect dialect: `forkScoped` (no `fork`), `Effect.exit` (no
  `either`), `Effect.catch` (no `catchAll`), curried `provideService`,
  no `Effect.runtime`, fibers lack `.join` (`Fiber.join(f)`); Scope via
  `Scope.make()` + curried provide, one process-lifetime scope.
- `Layer.provide` HIDES provider outputs — merge yielded providers
  (upstream `GitCore.test.ts` idiom).
- Codex/OpenCode adapters are `Stream.fromQueue` (competing consumers):
  exactly ONE live stream subscription per daemon — enforced
  (`another session is live`), parallel sessions = separate processes
  (`ProcessHost`). Never add a second subscriber.
- `git diff` blind to untracked files; `/tmp` → `/private/tmp`
  canonicalization at every boundary; repo path has a SPACE.
- Upstream files are READ-ONLY reference except the one additive wire
  line in `workbench.common.main.ts` (rebase rule).

## Contracts across the seam (daemon ⇄ fork)

- 13 RPC methods (`session.*`, `turn.*`, `run.*`, `approval.answer`) —
  shape pinned in `remote.test.ts`.
- Event vocabulary + status machine: daemon `session-state.ts` is SSOT;
  fork `agentEvents.ts`/`agentTypes.ts` mirror it (keep in lockstep).
- `--agent-*` CSS tokens resolve from the VS Code theme; frozen Cursor
  values pending reference (never hardcode agent colors).

## Definition of done (per slice)

Keepers green + stated open items in `backlog/<TRACK>-evidence.md` +
graph children updated + all three commits pushed. Live engine proofs
stay in `/tmp` (throwaway); only results land in `backlog/`.
Never claim UI rendering without a click; never claim parity without
the reference build.
