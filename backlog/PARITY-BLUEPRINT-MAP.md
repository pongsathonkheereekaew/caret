# Parity map — Cursor 3.19 blueprint vs Caret locked decisions (2026-09-10)

Verdict per section: ADOPT (do now), STAGED (do after dependency),
DIVERGE (deliberate, with reason), BLOCKED (needs user/external).

## Frozen reference (§1): BLOCKED

No reference build, no account, no captures on this machine. Everything
geometry-dependent (§13 measurements, §17 goldens) waits on: Cursor 3.19
exact patch build + macOS + ONE theme (recommend dark; user confirms) +
1440×900 atlas with the mandated metadata. Nothing pixel-claimed meanwhile.

## Information architecture (§2): ADOPT (contracts now, shells staged)

- Single session record / event stream / checkpoint / worktree owner:
  ALREADY our L8.6 law (one harness, one journal SSOT). Compliant.
- Shell-switch without state loss: contract adopted; IDE sidepane exists
  (extension), Agents Window shell STAGED on native workbench code
  (see §11) + reference atlas.

## Screens/components (§3–§9): STAGED with a cut line

- Composer menus (@ context groups, / skills-modes, context-usage tray,
  queue-vs-steer visuals): ADOPT as contract + extension UI incrementally.
  Queue/steer state contract matches our turn.send/turn.steer split.
- Timeline as TYPED events (§3D/§10): ADOPT — our journal already seeds
  it; tool/status vocabularies become `session-state.ts` this round.
- Review state machine (§5): ADOPT the machine; Monaco diff + finding
  overlay need the native side (staged). Our review doc + bring-back
  refusal already honor the edge-case spirit (overlap, dirty, missing).
- Plan/Debug/Browser-Design modes (§6–§8): DIVERGE for V1 scope — backend
  primitives first (plan doc = export bundle exists; debug = steer+logs
  exist; browser = absent). Full modes are P1, tracked per family.
- Search/Automations/Customize/settings (§9): settings sections that map
  to built features ship with them; Automations reserves IA only.

## State model (§10): ADOPT now

Session status + runtime kind + event vocabulary land as daemon-side
types with transition keepers this round (see `session-state.ts`).
Cloud/ssh runtimes exist as enum values with NO backend (honest: local
only per user decision) — the UI must render them disabled-with-reason,
never silently retask.

## Fork architecture (§11): STAGED (the big call)

- IDE Agent sidepane: extension WebviewView STAYS (docks natively,
  verified loading). Deepen, don't rewrite.
- Agents Window + WorkbenchShell mode service: NATIVE fork work under
  `src/vs/workbench/contrib/agentWorkbench/` per blueprint layout —
  staged on (a) reference atlas, (b) a display for verification.
  No second store ever; layout via IWorkbenchLayoutService.
- Never one giant webview: already our shape (composer-only webviews).

## Persistence/process (§12): ADOPT in shape

- SQLite for sessions/events/queue: our JSONL journal is the seed; SQLite
  migration is tracked (needs schema design, not started).
- Content-addressed artifacts: bundle.json + worktrees already file-based.
- Secrets in OS keychain: pairing file is 0600 tmp today — keychain
  migration tracked (needs Mac hands for keychain ACL test).

## Visual system (§13): ADOPT provisional

Starting-value tokens land as CSS variables now, labeled provisional;
frozen values need the reference build. No literal colors outside tokens.

## Performance (§14): ADOPT as budgets

Virtualized timeline + rAF batching + collapsed tool blocks become
acceptance checks when the timeline UI deepens; 10k-event + 1.5s startup
targets recorded, unmeasured.

## Roadmap (§15–§16): ADAPTED below (solo + Mac-only reality)

P0-reordered for one agent, no reference: contracts → IDE sidepane depth
→ native shell → review/plan/debug surfaces → visual calibration.
Estimate honesty: the blueprint's 5–7 engineers × 5–7 months assumes a
team; solo pace = P0 IDE-depth in weeks, native shell + calibration only
with reference access + display time.

## Validation (§17–§18): STAGED

Golden atlas structure (80–120 states) can be authored as a manifest
skeleton now; pixels, recordings, and a11y passes need the reference
build + a human (screen reader, keyboard-only, reduced motion).

## Branding (§20): ADOPT as constraint

Caret name/logo/copy stay original; Open VSX only (already fork
behavior); no Cursor/Microsot marks; commercial trade-dress = legal
review (blocked-external).
