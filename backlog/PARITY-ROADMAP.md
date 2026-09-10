# Parity roadmap — staged execution toward Cursor 3.19 (2026-09-10)

Capacity truth: solo agent + user, Mac-only, local-only, no reference
build. Order below is dependency order; anything marked NEEDS-USER waits.

## Done this round (machine-provable, committed)

- `backlog/PARITY-BLUEPRINT-MAP.md` — accept/stage/diverge/block per §.
- `session-state.ts` + 5 keepers — status machine, runtime honesty,
  emitted-vs-target event catalog (suite 66/66).
- Provisional `--agent-*` tokens wired to the composer (tsc 0).

## Phase A — IDE sidepane depth (agent, no user)

1. Typed timeline rendering over the journal (tool/status blocks,
   collapsed-succeeded, failed-expanded + retry affordance text).
2. Queue/steer visuals per the state contract (queued ≠ steered).
3. Review states incl. worktree-removed + huge-diff guards (text-level).
4. Search/history across chats (daemon journal index — extends audit.ts).
5. Virtualized transcript + rAF batching budgets as checks.

## Phase B — native Agents shell (agent + display, needs reference)

Files (new, isolated per §11B):
`src/vs/workbench/contrib/agentWorkbench/{common/{agentTypes,agentEvents,agentContextKeys,agentCommands,agentConfiguration,agentStorage},browser/{agentsWindow,navigation,home,session,timeline,composer,review,plan,debug,browserDesign,settings},electron-sandbox/agentWorkbench.contribution}.ts`
- WorkbenchShell mode service + layout via IWorkbenchLayoutService.
- Shell-switch contract (12 preserved fields — implement + keeper).
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
