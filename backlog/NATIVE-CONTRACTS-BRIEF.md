# Caret native-contracts handoff — paste-ready prompt (2026-09-10)

Paste everything below the line into a NEW session. It continues the
native workbench track; a separate session owns the daemon.

---

You are extending Caret's native workbench contribution. Read first:

- `/Users/pond/caret-work/caret/HANDOFF.md` (status + decisions)
- `/Users/pond/caret-work/caret/docs/TEAM-ONBOARDING.md` (repos, toolchain, hard-won mechanics)
- `/Users/pond/caret-work/caret/docs/ARCH-CONTRACTS.md` (seam map — daemon is SSOT, you mirror)
- `/Users/pond/caret-work/caret/backlog/PARITY-ROADMAP.md` (Phase B)
- `/Users/pond/caret-work/caret/backlog/NATIVE-SCAFFOLD-evidence.md` (what landed)

Environment (do not re-derive):

- Fork checkout: `~/caret-work/caret-desktop`, branch `caret-native`
  created from `caret` (`git checkout -b caret-native caret`). NEVER push
  to `caret`, NEVER force-push. Report SHAs; the main session merges.
- Toolchain: `~/.caret-tools/node-v24.18.0-darwin-arm64` on PATH.
  Space-free checkout (already is). No network needed.
- Gate: `node_modules/.bin/tsc --project ./src/tsconfig.json --noEmit
  --skipLibCheck` (~45s) must report ZERO errors in your files AND zero
  new errors tree-wide (baseline is clean — verify with `git stash` if
  you doubt an error's origin).

Ownership (parallel-safe split):

- YOU OWN: `src/vs/workbench/contrib/agentWorkbench/**` only.
- The single additive wire line in `workbench.common.main.ts` is yours
  to extend ONLY with more side-effect-free contrib imports.
- READ-ONLY: everything else in the fork, everything under
  `~/caret-work/upstream-synara` (daemon), `extensions/caret` (sibling
  session may touch it — never edit it yourself).
- Need a daemon change? Write it under `NEEDS-DAEMON:` and stop.

Scope (do exactly this, in order):

1. Shell-switch state contract: implement the 12 preserved fields from
   the roadmap (active session, scroll, draft, queue, file, cursor,
   tabs, terminal, browser URL, review file, panel visibility, widths)
   as a serializable `IShellState` + `captureShellState`/`restoreShell-
   State` pair in `browser/` with pure-logic keepers runnable WITHOUT
   the workbench (no workbench test harness exists — keep logic DOM-free
   and verify via `tsc` + a `bun` one-shot like the daemon tracks do).
2. Review/plan data into workbench types: mirror daemon `review.ts`
   (ReviewState, findings) and `plan.ts` (revision, tasks, buildRunId)
   as `browser/review/` + `browser/plan/` types with the same transition
   tables (copy the tables, cite the daemon file in a comment; behavior
   changes happen daemon-side, never here).
3. Context keys: bind `agentContextKeys.ts` to real sources (turn
   running, approval pending) where a service already exposes them;
   leave unbound keys declared-but-unset with a comment (never fake).
4. Keybinding migration table (docs only, append to your report): map
   each `caret.*` palette command to its future workbench slot +
   `when`-clause per C-03/C-04 (`backlog/command-map.md`). No bindings
   ship without the reference atlas.

Hard rules:

- No geometry, no pixels, no layout numbers — the reference build does
  not exist yet. Commands may announce un-built state (precedent in
  `agentWorkbenchActions.ts`); UI must never fake a surface.
- Upstream files: read-only except the one wire line. Match surrounding
  style (tabs, `.js` import suffixes, `localize2(key, message)`).
- Daemon SSOT: statuses, events, transitions mirror daemon files named
  above; on any conflict the daemon wins — record the drift, don't fork it.

Report back exactly this shape:

- `COMMITS:` SHAs on `caret-native`
- `VERIFY:` full-fork tsc result (error count in/out of your files),
  keeper method + results for pure logic
- `STATE-COVERAGE:` which of the 12 shell fields are captured vs stubbed
- `NEEDS-DAEMON:` (or `none`)
- `OPEN:` what remains native-side
