# The dead code around the shell is gone (2026-09-17)

The user asked whether the tree still carried dead code - the chrome shell we no longer use, and the
things that conflict with each other. The answer was yes, in three shapes, and this records what
went and what deliberately stayed.

## 1. Five modules nothing called

`artifact-filters.ts`, `artifact-lineage.ts`, `markdown-table.ts`, `settings-hits.ts` and
`transcript-find.ts` had **no production importer**: the only file that referenced each one was its
own test. They were the residue of the pre-SSOT `D06`/`D12`/`D13`/`A16` item set, and none of those
identifiers appears anywhere in `docs/` or `backlog/` any more.

The behaviour they describe is not missing: the shell draws it inline. `webview.ts:495` carries the
same markdown-table separator rule (`:?-{3,}:?`) as `markdown-table.ts`, `webview.ts:1428` is the
settings search that `settings-hits.ts` implemented, and `webview.ts:1915` is the artifact type
filter. Deleting the modules removes a second copy of each rule, not the rule.

Verification for this half is the import graph itself: `rg` for each module name across the repo
(excluding `desktop/`, `node_modules`, `dist`) returned only its own test file, before and after.

## 2. One agent surface per window

The plan's SSOT rule is one agent surface per window. There were two in a plain IDE window: the
docked view (`caretComposerDock`, still live) and a full page in an editor column, reachable three
ways - the `caretComposer` view under its own `caretAgents` activity-bar container, the
`caret.agentsShell` custom editor on a `*.caret-shell` document, and a fallback `WebviewPanel` when
the editor route failed. None of it was mounted in the Agents window since 2026-09-14; it stayed
reachable in the IDE window.

All three routes are gone, along with the `#panel` field they posted to. The callers that used to
reveal that page - `openCaretAgentsWindow`, the `setWorkbenchMode("agents")` path and
`openCaretSettings` - now call `revealAgentSurface()`, which focuses the surviving dock. The dock
itself is untouched, which is why `webview.ts` and S3 stay open in the plan.

Two smaller things fell out of the same edit:

- **`caret.openTask` is gone.** It and `caret.showAgents` were the same handler with two titles, so
  the palette offered one destination twice.
- **The restricted-mode renderer moved to `caretComposerDock`.** It was registered on
  `caretComposer`, which means a restricted window registered a provider for a view that no longer
  existed *and* left the dock with none - the dock would have opened as "no data provider".

`focusDock()` also lost its fallback chain: it used to try `caretComposerDock.focus` and then
`caretComposer.focus`. The repository's own dead-id guard caught that second id the moment the view
was deleted, which is the guard working as designed.

## 3. The third route inside the pinned fork

`desktop/src/vs/workbench/contrib/agentWorkbench/` was 13 files, tracked at the pinned base revision
and imported from exactly one place (`workbench.common.main.ts`). Nothing outside it imported any of
its modules. Its live effect was two command-palette entries:

- `caret.openAgentsWindow` ran the mode service and then opened view id `caretComposer` - the webview
  shell we had just retired. That is a second route to the Agents surface, and it pointed at the
  wrong surface.
- `caret.openIde` recorded the same mode flag and told the user they were already in the IDE.

The mode flag was readable only through `caretWorkbenchShell`, a context key no `when` clause reads,
and through `getLastShellState()`, which has no caller. The whole island is now a `removals` entry in
`patches/desktop/manifest.json`, and patch
`0034-caret-drop-agent-workbench-shell.patch` removes its single import line. One route is left:
`caret.showAgents` → `workbench.action.openAgentsWindow`.

The patch cuts cleanly because `workbench.common.main.ts` is a base file no other patch touches, so
it reverse-checks like any other. `desktop-patch-set.test.ts` proves the property that matters:
apply all 32 patches in manifest order to the pinned base and compare every touched path with the
checkout, byte for byte.

## What was deliberately kept

`apps/macos/src/webview.ts`, `TASK_WEBVIEW_CSS` and the shell-bound tests stay, because the dock is
still the IDE window's agent surface - deleting them now would cut working features, which the plan
records as S3's open exit gate.

`scripts/shell-render-fixture.ts` stays too, and for a concrete reason: it is a `Bun.serve` renderer
for that same live shell (it prints its URLs on start and serves the running/approval/panel
fixtures), and headless rendering is how the still-open AX/DOM parity check measures the shell
against the reference. Removing it because no script calls it would have removed the only tool for
an open item.

## One honest gap

Nothing here was verified on screen. The extension half is covered by the suite that models
activation, and the desktop half by `tsc` plus a rebuilt bundle with zero occurrences of the retired
command, but no one has clicked the Agents entry in a freshly packaged build. The receipt lists that
under `notVerified`, along with the stale `out-vscode*` outputs inside the pinned checkout (build
output, regenerated at package time; nothing shipped in `dist/` is stale).
