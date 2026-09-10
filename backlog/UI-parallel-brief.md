# Caret UI parallel session — paste-ready prompt (2026-09-10)

Paste everything below the line into a NEW session. It is self-contained;
that session must NOT touch the daemon or the M4 hooks track.

- 2026-09-10 (main session): new RPC `run.export{dir, overwrite?} →
  {path, files, events}` on BOTH transports (see
  `backlog/M7-export-evidence.md`). Suggested composer affordance: directory
  picker → status `{files} files, {events} events → {path}`; refusals as
  status text. Daemon files touched: `export.ts` (new), `session-api.ts`
  (+goal tracking), `remote.test.ts` (shape list). No action needed unless
  you take the Export button.
- 2026-09-10 (main session): new RPC `turn.steer{input} → {steered:true}`
  on both transports (see `backlog/AG05-steer-rpc-evidence.md`). Suggested
  composer affordance: Steer button, enabled only while a turn runs.
  Facade live-proven; RPC-level live proof deferred to next engine run.
---

You are working on Caret, a Code-OSS desktop fork with an agent extension.
Your track is UI-only, parallel to a daemon track. Read these files first:

- `/Users/pond/caret-work/caret/HANDOFF.md` (status + mechanics)
- `/Users/pond/caret-work/caret/agent.md` (spec authority, gates)
- `/Users/pond/caret-work/caret/backlog/H05-ui-evidence.md` (manual click script + trust posture)
- `/Users/pond/caret-work/caret/backlog/M4-picker-evidence.md` (the Runs surface you will verify)

Environment (do not re-derive, do not float versions):

- Fork checkout: `~/caret-work/caret-desktop`, you work on branch `caret-ui`
  created from `caret` (`git fetch origin; git checkout -b caret-ui origin/caret`
  or from local `caret`). NEVER push to `caret`, NEVER force-push. When done,
  report commit SHAs; the main session merges.
- Toolchain: `~/.caret-tools/node-v24.18.0-darwin-arm64`, repo path contains
  a SPACE — run all builds from space-free checkouts (the fork already is).
- Compile: `~/caret-work/caret-desktop/node_modules/.bin/tsc -p ./` inside
  `extensions/caret` — must exit 0. Boot check: `./scripts/code.sh` from
  `~/caret-work/caret-desktop`.

Ownership (parallel-safe split — respect it exactly):

- YOU OWN: `extensions/caret/src/extension.ts` (webview only),
  `extensions/caret/package.json`, `extensions/caret/package.nls.json`.
- READ-ONLY: `extensions/caret/src/completion.ts`, `edit.ts`, `search.ts`,
  everything under `~/caret-work/upstream-synara` (daemon).
- If you need a daemon change, do NOT make it — write it in your report
  under `NEEDS-DAEMON:` and stop at the boundary.

Daemon contract (stable, read-only — verify against, never extend):

- RPC over daemon stdio: `session.start{repoDir,runId}`, `turn.send{input}`,
  `approval.answer{requestId,answer}`, `run.review{}`, `run.reject{}`,
  `run.bringBack{}`, `run.list{}→{runs:string[]}`,
  `run.remove{worktreeDir}→{removed:boolean}`, `session.stop{}`.
- Events: `daemon.ready`, `approval.requested{requestId,requestType,detail}`.
- Refusals are data (`removed:false`, error strings) — surface them as
  status text, never force.

Scope (do exactly this, nothing else):

1. U1 — re-verify extension load after the Runs picker changes (same bar as
   H05-ui-evidence machine section): compiles, auto-included in dev builds,
   exthost loads `caret.caret`, activates with zero errors, then revert any
   temporary activation hack. Ship state stays `onView:caretComposer`.
2. U2 — static audit of the composer webview in `extension.ts` `html()`:
   every button id has exactly one handler, every posted `{command}` has a
   matching `onUiMessage` case (send/answer/review/reject/bringBack/new/runs),
   no dead ids, no inline event attributes (CSP nonces intact). Fix gaps.
3. U3 — extend the manual click script in your report (do NOT edit
   `backlog/` files — different session owns them) with Runs-picker steps:
   create second run → Runs… → remove clean run → dirty-run refusal text.
   A human will execute it later.

Hard rules:

- Locked posture, do not relitigate: `capabilities.untrustedWorkspaces`
  stays `false` (agent runs shell — correct, not a bug); no floating
  keybindings (C-03/C-04 in `backlog/command-map.md` — any new binding needs
  a narrowing `when` clause or it does not ship); approval cards show the
  exact command BEFORE execution; bring-back refusal is never forced.
- No stubs/mocks counted as done. No new dependencies. Keep diffs minimal.
- Commit on `caret-ui` with messages `UI: <what> (<verify>)`.

Report back exactly this shape:

- `COMMITS:` SHAs on `caret-ui`
- `VERIFY:` tsc exit, load-check log lines, audit findings fixed
- `MANUAL-SCRIPT:` numbered click steps incl. Runs flow
- `NEEDS-DAEMON:` (or `none`)
- `OPEN:` what remains UI-side
