# Native scaffold evidence — agentWorkbench contrib (2026-09-10)

Fork (`caret` branch): `src/vs/workbench/contrib/agentWorkbench/`
(common ×6, browser mode-service + actions, electron-sandbox entry)
plus one import line in `workbench.common.main.ts`.

## Proven

- Full-fork typecheck (`tsc -p src/tsconfig.json --noEmit`,
  ~45s): **zero errors** in contrib files (one wrong relative import
  caught and fixed in the same pass).
- Registration idiom copied from the in-tree chat contrib
  (`registerAction2`, `ServicesAccessor`, `localize2` overload verified
  against `src/vs/nls.ts`).
- Upstream touch: exactly one additive import line; no modified
  upstream files (rebase-friendly).

## Honest bounds

Scaffold only: two commands that announce their own un-built state,
no layout, no pixels, no geometry claims. Rendering waits on the
Cursor 3.19 reference atlas (user track).
