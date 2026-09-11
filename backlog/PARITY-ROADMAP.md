# Parity roadmap — staged execution toward Cursor 3.19 (2026-09-10)

Capacity truth: solo agent + user, Mac-only, local-only, no reference
build. Order below is dependency order; anything marked NEEDS-USER waits.

## Done this round (machine-provable, committed)

- `backlog/PARITY-BLUEPRINT-MAP.md` — accept/stage/diverge/block per §.
- `session-state.ts` + 5 keepers — status machine, runtime honesty,
  emitted-vs-target event catalog (suite 66/66).
- Provisional `--agent-*` tokens wired to the composer (tsc 0).

## Phase A — IDE sidepane depth: DONE machine-side (2026-09-10)

Queue, typed timeline, chat-search backend, elapsed/compact — all
committed with keepers. Search UI surface implemented 2026-09-11
(composer Find + `chat.search`); remaining bits need human eyes (click,
render, virtualized perf).
## Phase B — native Agents shell: SCAFFOLD LANDED (2026-09-10)

VEHICLE (user decision): native workbench contrib, team to follow.
`src/vs/workbench/contrib/agentWorkbench/` ships with common contracts
(types/events/context-keys/commands/config/storage), the mode-service
interface, two honest scaffold commands, and one additive wire line in
`workbench.common.main.ts`. Full-fork `tsc --noEmit`: ZERO errors in
our files. Layout/rendering still waits on the reference atlas — the
scaffold adds commands, not pixels.
Next: Agents-window layout + session timeline against the mode service
(needs reference atlas for geometry); shell-switch contract with the 12
preserved fields; React-panel vehicle dropped by user decision.
- NEEDS-USER: reference atlas for every geometry number.

## Phase C — visual calibration (mostly NEEDS-USER)

- Freeze 3.19 patch build + dark theme + 1440×900 + metadata manifest.
- 80–120 golden states (skeleton authorable now, pixels need Mac hands).
- Playwright-Electron harness, thresholds per §17.
- macOS-only calibration (Windows/Linux dropped by decision).

## Phase D — modes & depth (mixed)

- Plan/Debug/Browser-Design surfaces (backend primitives exist).
- MCP Apps, Automations IA→build, Customize hub, settings sections.
- SQLite migration for sessions/events/queue; keychain secrets.
- a11y passes (roles/names/focus/live-regions/reduced-motion) — human.

## NEEDS-USER checklist (nothing here proceeds without)

1. Cursor 3.19 download + account on the Mac (reference freeze).
2. Theme choice (dark recommended) + fixture repo decision.
3. 5-min click sessions per surface (atlas capture).
4. Apple certs into keychain (signing; Dev account exists).
5. iPhone + APNs key (mobile); cloud/relay reversal if ever.
6. Legal review before any trade-dress-close public release.
