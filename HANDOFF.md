# Caret — Continuation Brief (2026-09-10)

For a new session: read `agent.md`, then this file, then the evidence in
`backlog/`. Do not replay the conversation; the files below are the state.

## Objective

Build Caret to the **clone-verified** gate in `docs/IMPLEMENTATION-PLAN.th.md`
(v5, authoritative): 198 parent requirements, 75 UI families, behavior +
visual + quality + ops evidence. No scope cuts, no silent descopes.

## Status: backend proven (31/31 tasks), surfaces open

Done with evidence in `backlog/`: M0 pins/graph/command-map · F01 Code-OSS
macOS pass · F02 approval control-path PASS · F03 Codex+OpenCode ready ·
F04 scoped-undo + bridge contract · H02 branded fork boots as Caret ·
H05 headless slice 7/7 + extension loads/activates/trust-gated · M3 Tab
(measured), inline edit, exact search · M4 worktrees (4/4 keepers),
isolated-by-default binding (6/6), steer/resume-matrix, MCP 5/5, prune.

Open: H05 click-through (manual script in `backlog/H05-ui-evidence.md`),
M3 tail (multiline/next-edit, Tab keybinding, semantic index), M4 tail
(retention cap, MCP SSE/OAuth), M5/M6 remote+mobile, M7 release, M8–M11.

## Locked decisions (do not relitigate without new evidence)

- Single harness (L8.6); Synara services preferred, Paseo fallback, direct
  adapters last resort. Daemon versioned on `caret-adapter` branch.
- Local-first: FIM + agents run on this machine; no code leaves it for Tab.
- Approval-gated writes; raw whole-repo restore prohibited on user
  workspaces; bring-back refuses on overlap (never forces).
- Resume matrix: OpenCode stop/resume SUPPORTED; Codex resume-after-stop
  UNSUPPORTED (silent stall) → capability flag + semantic handoff.
- V1 Tab = single-line chat-mode (p50 ~550ms); multiline gates unmet, unclaimed.
- Zen IS the managed gateway (no separate "Go"); free tier for spikes.

## Hard-won mechanics (read before touching Effect/git code)

- `Layer.provide` HIDES provider outputs — merge providers you yield
  directly (upstream `GitCore.test.ts` shape is the reference).
- smol Effect dialect: `forkScoped` (no `fork`), `Effect.exit` (no `either`),
  `Effect.catch` (no `catchAll`), yield tags as `Ns.Tag`.
- `git diff` is blind to untracked files — review/bring-back handle them.
- Canonicalize paths (`/tmp` → `/private/tmp`) at every boundary.
- Repo path contains a SPACE: toolchain + checkouts live outside it.

## Pointers (see `docs/UPSTREAM-LOCK.md` for SHAs)

| What | Where |
|---|---|
| Control repo (docs, backlog, agent.md) | `/Users/pond/Documents/LLM Projects/caret` |
| Caret fork (`caret` branch) | `~/caret-work/caret-desktop` |
| Pristine Code-OSS / Synara | `~/caret-work/desktop`, `~/caret-work/upstream-synara` |
| Daemon (`caret-adapter` branch) | `~/caret-work/upstream-synara/apps/caret-daemon` |
| Toolchain | `~/.caret-tools/node-v24.18.0`, `~/.bun` (bun 1.4.2), `~/.opencode` (CLI 1.18.30), `~/.local/bin/codex` (0.153.4) |
| Models/serving | `~/.caret-models/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf`, `~/caret-work/llama.cpp` (v0.4.0) |

Key commands: FIM server one-liner in `backlog/M3-completion-evidence.md`;
daemon proofs `bun run --cwd apps/caret-daemon src/{slice,isolatedslice,resumesteer,ocresume}.ts`;
suites `bun x vitest run apps/caret-daemon/...`; fork `./scripts/code.sh`;
manual UI script in `backlog/H05-ui-evidence.md`.

## Awaiting the user (9 decisions explained in chat 2026-09-10)

Reference access · signing ($99+$) · mobile route + real devices · cloud
provider/budget · Zen top-up + monthly cap · real repo name/remote · relay
choice · APNs sender · next-surface priority (recommended: M7, Agents, mobile, cloud).

## Risks

Codex resume silence (declared, flagged) · Zen $0 blocks paid evals ·
visual claims reference-gated · Windows/Linux need CI · Copilot
disentangle at M1 (raw derefs) · no update server/signing yet.

## Addendum 2026-09-10 evening (solo push, no human)

Daemon suite 51/51 on `caret-adapter`. Shipped since the brief: scoped
`cmd+k` inline-edit keybinding; multiline REJECTED with probe evidence
(truncation + repetition); run picker (`run.list`/`run.remove`, 6-way
guards); MCP streamable-HTTP (8/8) with auth seam; setup hooks (no
shell/discovery); session-API factory + TCP gateway (pairing, revoke,
idempotency, resync) + `serve-tcp.ts` entry; `run.export` bundle +
`turn.steer` RPC; lease/handoff/webhook/audit/forge primitives.
Live Codex proofs over TCP: turn+review+export (21s), mid-turn steer
(78s), Gitea 1.27.3 PR matrix (8s, Rosetta binary, /tmp instance).
Fork `caret`: composer Steer/Export/Runs buttons (8/8 wired, tsc 0),
`CARET.md` user guide. UI session left no artifacts (branch `caret-ui`
empty); its scope absorbed. Still human/external: click-through,
signing/repo-remote, devices/APNs, cloud/OAuth providers, Zen top-up.
