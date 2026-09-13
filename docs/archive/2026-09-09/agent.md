# Caret — Agent Build Goal

> Archived 9 September 2026 baseline. Not the living spec.
> Current rules: [AGENTS.md](../../../AGENTS.md).

> Goal: implement Caret end-to-end until the final product passes the
> **clone-verified** gate defined in the plan. No scope cuts, no silent
> descope to MVP. `blocked-external` never counts as pass.

## 1. Authoritative spec (conflict order)

1. `docs/archive/2026-09-09/IMPLEMENTATION-PLAN.th.md` — v5, 9 Sep 2026. Historical only. Living rules: [AGENTS.md](../../../AGENTS.md).
2. Section L (Synara adoption) + L8 (single-harness contract) — wins over A–K on UI/backend conflicts.
3. Section J (handoff v4, H01–H16) + Section K/K2 (scrutinize) — execution contracts.
4. Supporting snapshots: `PARITY-MATRIX`, `UI-SPEC`, `ARCHITECTURE`,
   `ROADMAP-AND-ACCEPTANCE`, `GAPS-AND-DECISIONS`, `PROVIDER-CONNECTIVITY`,
   `PLATFORM-AND-COMPATIBILITY`, `OPEN-SOURCE-ASSESSMENT`,
   `SOURCE-COVERAGE` + `SOURCE-COVERAGE-EXTENDED`, `HANDOFF-DETAILS`,
   `SYNARA-ASSESSMENT`, `SCRUTINIZE-REVIEW`, `STARTER-BACKLOG`, `DECISION-MAP`.

Baseline (frozen 9 Sep 2026, do not auto-advance on Cursor latest):

- **198 parent requirements** (158 baseline + 40 PX), every parent broken into
  executable child cases before parent can pass.
- **75 UI screen families** (57 + 18), each expanded to applicable
  loading/empty/error/permission/offline/focus/modal states.
- **29 tool contracts** (J4), **16 work packets** H01–H16 (J7),
  **6 Synara packets** SYN-01…06 (L5).
- **261 retrieved source URLs** — routing ledger only, not field-level proof.
- Milestones M0–M11, feasibility spikes F01–F09, acceptance suites Q01–Q11.

## 2. Locked architecture decisions

- **D02**: desktop (macOS/Windows/Linux) = **Code-OSS fork**. Synara Electron
  app never replaces it; Synara file editor never replaces the extension host.
- **UI start**: **Synara-derived UI** under Caret brand (chat/composer/approval,
  theme/tokens, review panels). Cursor visual 1:1 is a later refinement track —
  Synara appearance passing is NOT Cursor pixel parity.
- **Backend**: single orchestration owner. Preferred candidate = **adapted
  Synara services/contracts**; fallback = Paseo, then direct engine
  coordinator. Never run two session/worktree/history owners at once.
- **L8.6 single-harness rule (permanent)**: one permission model (PX-10…13),
  one approval UX, one event journal (SSOT), one session/worktree/checkpoint
  owner. Codex/OpenCode/Pi are thin **engine drivers** under the harness, each
  declaring `supported | emulated | unsupported` per capability. Never add a
  second harness.
- **Driver order**: 1) OpenCode driver first (coverage via config: OpenRouter /
  Go / DeepSeek provider entry `deepseek`), 2) Codex driver second (loop-quality
  reference: approval/steer/resume). Pi and OMP (`can1357/oh-my-pi`, Pi-fork
  IDE-wired) are **deferred** — pattern reference only, no separate driver
  until the first two prove a gap config cannot close. DeepSeek Creator is a
  model via OpenCode config, never a separate harness.
- **Providers**: Codex = official app-server + ChatGPT login; OpenCode server =
  Go/OpenRouter via engine config. Engines own auth; Caret never scrapes or
  re-routes subscription tokens. Quota exhausted → stop/wait, never silently
  switch to a billed path.
- **Local-first**: laptop machine before cloud compute. Relay ≠ compute;
  LAN web demo ≠ native mobile; simulator ≠ device proof.

## 3. Build order (single-agent friendly)

```
M0 freeze → F01–F04 feasibility → vertical slice (R04/H05) → M3/M4 →
M5/M6 → M7 personal release → M8 cloud → M9/M10 → M11 → H16 certification
```

Packet sequence: H01 → H02 → H03 → H04 → H05 → H06 → H07 → H08 → H09 →
H10 → H11 → H12 → H13 → H14 → H15 → H16, with SYN-01…06 folded in per L5.
Proposed repo layout (from ARCHITECTURE.th.md, create when M0 pins revisions):

- `desktop/` — Code-OSS fork (pinned SHA submodule/checkout)
- `upstream/paseo/` or `upstream/synara/` — pinned backend source dep + patch manifest
- `packages/contracts/`, `packages/desktop-bridge/`, `packages/daemon-adapter/`
- `apps/ios/`, `apps/web/`, `services/cloud/`, `tests/fixtures/`

## 4. Hard gates (no bypass)

- **G-VIS-01/02**: runtime reference capture + measured tokens per surface
  BEFORE pixel freeze of that surface. No access → `reference-blocked`, never
  marketing geometry.
- **F04 (dirty-buffer gate)**: versioned editor bridge + conflict/undo fixtures
  pass BEFORE any write-enabled engine integration. Never disk-watcher overwrite.
- **H04**: pre-execution approval interception proven; facade must not enforce
  after side effects already happened.
- **Per-operation/field conformance** (J6): every API/SDK/config callable gets
  source section/hash, mapping, types, auth scope, idempotency, errors, fixture,
  result. Parent passes only when all children pass.
- **Quality**: agent corpus ≥30 tasks × 3 runs paired vs reference (≤5pp gap,
  one-sided 95% bound); completion corpus ≥200 edit opportunities with
  latency/validity split. No averaging away failing groups.
- **Visual**: same-platform overlay/diff — geometry ≤2px, baseline ≤1px,
  flat-region ΔE00 ≤2 post-normalize, motion ≤max(1 frame, 10%). Mask only
  pre-declared dynamic areas.
- **Final H16**: all 198 parents + applicable children, all 75 families/states,
  behavior + quality + ops evidence, license/NOTICE inventory, known-deltas log.
  Only then `clone-verified`; else `clone candidate — remaining gaps`.

## 5. Operating rules for the implementing agent

1. Status per requirement is exactly one of
   `planned | implemented | verified | blocked-external`. Writing a test or
   citing upstream ≠ `verified`; only an observed run on the release candidate
   counts, linked requirement → case → revision → result → capture.
2. No stubs, mock responses, or disabled controls counted as done.
3. One owner per session/store; typed small boundaries; no speculative vector
   service before measured need (J8).
4. Keep Caret contracts free of package internals; every reuse pinned by
   revision with license/patch inventory (Apache-2.0/MIT checks per component;
   Synara MIT keeps T3 Tools Inc. + Emanuele Di Pietro notices).
5. Regression with upstream changes only on related code/provider/reference
   change; baseline updates go to delta backlog, never silent scope creep.
6. Costs (OpenRouter usage, completion/media/speech, signing, relay/push,
   VM time) tracked separately — never "open source therefore free".
7. Ask the user ONLY for what cannot be inferred at its gate: reference
   app/account access, signing/devices, provider entitlement, budget/cloud
   approval. Never purchase, provision, or invent credentials; never paste
   secrets into chat.

## 6. Current state + first actions

State: planning complete, zero implementation. No source trees, no pinned
revisions, no builds, no inference runs (per D01 planning-only).

1. H01/SYN-01: freeze reference versions, build requirement→child-case graph,
   resolve keyboard/layout conflicts, pin Code-OSS + Synara (`59db80a` snapshot
   is the assessed revision, re-pin at build time) revisions.
2. F01/F02/F03 spikes with bounded fixtures; record Paseo-vs-Synara-vs-direct
   backend decision in an ADR.
3. F04 dirty-buffer fixtures before write-enabled slice.
4. R04 vertical slice on a real engine + real editor, then proceed per §3.

## 7. Goal acceptance

Done = `Caret release + Cursor reference build per surface + supported
platform matrix + evidence bundle` satisfying H16. Until then, every status
report states what is `verified` vs `planned` vs `blocked-external` with
counts against the 198/75 denominators.
