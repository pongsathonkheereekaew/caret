# Caret — Continuation Brief (2026-09-10)

For a new session: read `AGENTS.md`, then this file, then the evidence in
`backlog/`. `agent.md` is a historical pointer. Do not replay the conversation;
the files below are the dated control-repo state.

## Objective

Build Caret to the **clone-verified** gate in `docs/IMPLEMENTATION-PLAN.th.md`
(v5, authoritative): 198 parent requirements, 75 UI families, behavior +
visual + quality + ops evidence. No scope cuts, no silent descopes.

## Status: graph 17 verified / 35 implemented / 136 planned / 10 blocked-external

Done with evidence in `backlog/`: M0 pins/graph/command-map · F01 Code-OSS
macOS pass · F02 approval control-path PASS · F03 Codex+OpenCode ready ·
F04 scoped-undo + bridge contract · H02 branded fork boots as Caret ·
H05 headless slice 7/7 + extension loads/activates/trust-gated · M3 Tab
(measured), inline edit, exact search · M4 worktrees (4/4 keepers),
isolated-by-default binding (6/6), steer/resume-matrix, MCP 5/5, prune.

Open: H05 click-through (manual script in `backlog/H05-ui-evidence.md`),
M3 tail (multiline/next-edit, Tab keybinding, semantic embed-wiring +
independent benchmark; incremental index + symbols done →
`backlog/SEARCH-index-evidence.md`), M4 tail
(MCP OAuth + HTTP elicitation-stream; retention cap done 2026-09-10 →
`backlog/M4-retention-evidence.md`; resources/prompts/elicitation-stdio
done → `backlog/M4-backend-evidence.md`), M5/M6 remote+mobile, M7 release, M8–M11.

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
| Control repo (docs, backlog, agent.md) | `/Users/pond/caret-work/caret` |
| Caret fork (`caret` branch) | `~/caret-work/caret-desktop` |
| Pristine Code-OSS / Synara | `~/caret-work/desktop`, `~/caret-work/upstream-synara` |
| Daemon (`caret-adapter` branch) | `~/caret-work/upstream-synara/apps/caret-daemon` |
| Toolchain | `~/.caret-tools/node-v24.18.0`, `~/.bun` (bun 1.4.2), `~/.opencode` (CLI 1.18.30), `~/.local/bin/codex` (0.153.4) |
| Models/serving | `~/.caret-models/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf`, `~/caret-work/llama.cpp` (v0.4.0) |

Key commands: FIM server one-liner in `backlog/M3-completion-evidence.md`;
daemon proofs `bun run --cwd apps/caret-daemon src/{slice,isolatedslice,resumesteer,ocresume}.ts`;
suites `bun x vitest run apps/caret-daemon/...`; fork `./scripts/code.sh`;
manual UI script in `backlog/H05-ui-evidence.md`.

## Awaiting the user (do not block the rest)

Cursor 3.19 atlas / pixel freeze · periodic UI click-tests · Codex
quota (~Sep 16) · iPhone + APNs / MCP OAuth only if those scopes open.
Apple signing is last. Cloud / Win+Linux / Tailscale stay locked off.

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
2026-09-10 night: CUS-11 resources/prompts/elicitation-stdio on both
transports (suite 104/104: stdio MCP 9/9, HTTP MCP 11/11; HTTP
elicitation-stream + full OAuth stay open).
PX-24 ACP streaming (engine events → message chunks) + stdio framing
keeper (suite 109/109, ACP 5/5; images + multi-session stay open by
session-API design).
PX-25 CLI --json envelopes + send --ask approval loop (suite 111/111;
PX-25 verified 17/198).
REV-06 local commit lifecycle + file-remote sync over real git (suite
114/114; hosted origin + autopilot stay blocked-external).
Live Codex proofs over TCP: turn+review+export (21s), mid-turn steer
(78s), Gitea 1.27.3 PR matrix (8s, Rosetta binary, /tmp instance).
Fork `caret`: composer Steer/Export/Runs buttons (8/8 wired, tsc 0),
`CARET.md` user guide. UI session left no artifacts (branch `caret-ui`
empty); its scope absorbed. Still human/external: click-through,
signing/repo-remote, devices/APNs, cloud/OAuth providers, Zen top-up.

## User decisions 2026-09-10 (from chat, no Mac needed)

- Apple Developer: EXISTS, personal-use only for now (no TestFlight /
  external distribution). **Signing deferred to the end of the project**
  (user 2026-09-11 12:07). Do not block local work on certs.
- Engine budget: OpenCode Go subscription (NOT Zen). OpenCode driver is
  the entitled path; Zen $0 balance is irrelevant.
- Cloud: NONE — local-only, machine stays on always. M8 CLOUD parents
  (except the local-useful CLOUD-08 seed) marked blocked-external by
  explicit user decision, not by evidence gap.
- Remote: `https://github.com/pongsathonkheereekaew/caret` (exists).
  Control repo pushes here; code monorepo follows ARCHITECTURE layout.
- Relay: NONE (no Tailscale — matches Paseo). Remote = loopback +
  LAN-direct only; LOC-04 relay stays open, loopback verified.

## User decisions 2026-09-10, part 2 (billing + platform)

- Billing: LEAVE IT. No card ever attached; the payment-failure flag is
  account-side. CI runs on the self-hosted Mac runner (green, 29s) —
  github-hosted matrix stays off.
- Platform: MAC ONLY. Windows/Linux support dropped from the matrix
  (was: pending CI). C-04 upstream-chord gate now macOS-scoped.
- Repo is PRIVATE (stays so until user says otherwise).

## Addendum 2026-09-11 morning (solo push; user in Cursor)

User confirmed Cursor is running on this Mac. Recorded runtime
3.20.10 / `d6f462c` — **not** a baseline bump (plan stays 3.19);
see `backlog/G-VIS-runtime-evidence.md`. No atlas, no pixel claims.

Shipped this round, daemon suite **120/120** on `caret-adapter`:

- HTTP MCP elicitation over GET event stream (stdio parity for
  `elicitation/create`; OAuth still blocked-external).
- `chat.search` RPC + composer Find box/filter/jump-to (machine tsc 0;
  click still open).
- Local embed-client seam (nomic prefixes + 900-char cap) against a
  fixture vector server.

Still human/external: H05 click-through, visual atlas vs frozen 3.19,
signing certs, devices/APNs, MCP OAuth provider.

## Addendum 2026-09-11 late morning

- `turn.cancel` + reconnect warnings in Agents UI (soft Stop/New).
- `code.search` / `embedAndRank`: fixture-ranked semantic retrieval;
  composer Find option **files (semantic)**; fails loud without
  `CARET_EMBED_URL`.
- `caret.openAgentsWindow` focuses the real `caretComposer` view
  (no invented Agents-window geometry).

## Addendum 2026-09-11 Agents slice

AG-02/04/09 implemented (not verified): session list
(select/rename/pin/archive/forget), queue Up/Down/Edit, plan todos from
explicit events only. Evidence: `backlog/AG-session-list-evidence.md`.

Human 2026-09-11 11:27: Agents + session row + Review diff on
`hello-ui.txt` confirmed. Codex ChatGPT quota exhausted (retry ~Sep 16).
Follow-up: hide unmapped/telemetry rows; `item.started`/`item.completed`
upsert todos; toolbar wraps; quota errors hit the status line.

SEARCH-03 implemented (not verified): background per-root index job,
cached vectors, bounded file/chunk progress, rebuild/pause/resume,
per-file failures, and terminal states.
SEARCH-05 implemented (not verified): ignore ≠ sandbox; ignored files
stay off index/prompt attach.
SEARCH-06 implemented (not verified): realpath job identity. Branch
invalidation + large-repo combinations remain open.
Evidence: `backlog/SEARCH-index-evidence.md`.

AG-10 implemented (not verified): artifact catalog bound to run+revision;
composer Artifacts/Open routes image/video vs text. Evidence:
`backlog/AG-artifacts-evidence.md`.

SEARCH-07 implemented (not verified): explicit docs URL fetch/cache/refresh;
`@Docs` stays open pending reference. Evidence:
`backlog/SEARCH-docs-evidence.md`.

## Addendum 2026-09-11 12:07 (user)

- Cursor screenshots recorded (chat + empty workbench + Agents Window on
  the right). IA observation only — not a 3.19 pixel freeze. See
  `backlog/G-VIS-runtime-evidence.md`.
- Apple signing stays last. Continue all other local work.
