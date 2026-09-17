# The Apps panel's Changes and File entries are panes of the panel (2026-09-16)

Item 3b of the parity queue. Item 3's first slice made the strip a pane switcher
(`runLauncher(launcher, 'reuse' | 'new')`), but only `browser` and `terminal` had a pane to switch
to: `changes` ran `workbench.action.agentSessions.newChangesTab` and `file` ran quick open, so
picking either one put its surface in the editor group, outside the panel, and the rail's active
mark had nothing to report for them. In an empty window both commands resolve without opening
anything at all, so the two entries looked dead.

## The change

Four files, all created by `patches/desktop/0021-caret-agent-home-utility.patch`, so the work is
folded into 0021 rather than added as a later patch (plan section 6: a patch that creates a file
cannot be followed by a patch that edits it - the reverse-check of the first one fails by
construction).

| file | change |
| --- | --- |
| `appsPanelModel.ts` | `AppsPanelTabKind` = `terminal \| browser \| changes \| file`; `createChanges()` / `createFiles()` add a tab for a pane the window owns one of, and return the open one on a repeat request |
| `agentHomeUtilityEditor.ts` | every entry of `LAUNCHERS` is `hosted` now (no `commandId`); `createHostedPaneView()` builds the two new pane bodies; `activateTab`/`layoutActiveInstance` drive them; the rail's active mark moved into `applyActiveTab` |
| `appsPanelReact.ts` | the instance-tab row names all four kinds (`tabIconId`), not just browser-or-terminal |
| `media/agentHomeUtility.css` | `.caret-apps-instance.caret-apps-pane` (and its `.active` form) so a hosted view fills the pane |

Why the two panes are single-instance: the surfaces behind them belong to the window, not to the
pane. There is one active session and one workspace, so a second Changes tab would show the same
session twice. Both `reuse` and `new` therefore mean "show that pane" for those two ids.

## What the panes show

The panel no longer re-implements these surfaces; it hosts the base's own:

- **Changes** hosts `ChangesViewPane` (the same view the base's Changes container shows) inside a
  `PaneView`, because a `ViewPane`'s home is a pane view and the panel is what sizes it here. The
  pane builds its header and body in `render()`, which a view container would have called for it.
- **File** hosts `EmptyFileEditor` - the content the base's Files tab shows - created against the
  panel's own editor group; its Search Files action is the base's, wired to quick open.

The **file tree stays the base's Files view**. `IExplorerService.registerView()` keeps a single
`view` slot, so a second explorer built inside the panel would take that slot over from the one the
window already owns. The panel hosts the Files surface; it does not add a second owner of it.

## Verification (packaged app)

Launch: `open -n VSCode-darwin-arm64/Caret.app --args --password-store=basic
--use-inmemory-secretstorage --remote-debugging-port=9343 --agents` after
`bun scripts/build-caret.ts --package`.

CDP (renderer state) - one strip, four panes, one editor tab:

| step | tabs | rail marked | active pane |
| --- | --- | --- | --- |
| fresh panel, rail `Changes` | `[Changes]` | Changes | `.caret-apps-pane-changes` 322x791, `.pane-header` reads `Changes`, body `Changes / No changed files / Checks` |
| rail `File` | `[Changes, File]` | File | `.caret-apps-pane-files` - `Files / Select a file from the Files view / Search Files ⌘P` |
| rail `Changes` | `[Changes, File]` | Changes | switches in place, no new tab |
| rail `Browser` | `[Changes, File, Browser]` | Browser | hosted browser, address bar present |
| rail `Changes`, `Terminal`, `Browser`, `File` | unchanged set | follows every step | each entry shows its own pane |

The editor group kept exactly one tab, `Apps`, through all of it, and the group's title strip stayed
`display: none` - Changes and File no longer appear as editor-group tabs.

Real input (Computer Use, `@oai/sky`, path-targeted at the packaged app) - the method the plan
requires for anything drawn over the hosted page:

| step | result |
| --- | --- |
| AX tree of the Agents window | rail = 4 toggle buttons `Changes / Browser / Terminal / File`, then `Open new tab menu`, then `Toggle Pinned Summary`; menu bar has no Selection/Go/Run/Terminal |
| real click `+` -> `File` | File tab appears selected, rail `File` = 1, body renders `Files / Select a file from the Files view / Search Files (⌘P)` |
| real click `+` -> `Changes` | Changes tab selected, rail `Changes` = 1, body renders the changes view (`CHANGES` heading, actions toolbar, versions picker) |
| real clicks rail `Changes` / `File` / `Changes` | selection and marks follow on every switch, no extra tab |
| real click `+` -> `Browser`, then `+` -> `Browser` again (the menu opens over the hosted page) | 1 Browser tab, then 2 - the instance path still works over a native view |
| real clicks rail `Changes` then `Browser` | switches between the hosted pane and the hosted browser in both directions |

Bugs found and fixed while verifying:

- Switching to an already-open pane through the rail left the rail's mark on the previous pane: the
  mark was updated in `renderTabs` (model changes only), and a switch to an open pane changes no
  model. It now updates in `applyActiveTab`, which is where the active tab is known.
- A hosted `ViewPane` rendered an empty shell until the panel called `pane.render()` - the view
  container does that before handing a pane to its `PaneView`, and this host has to do it itself.

Gates: `bun scripts/prepare-desktop.ts` (28 patches / 18 removals), `bun test
apps/macos/test/desktop-patch-set.test.ts` (the set applies in manifest order and reproduces the
checkout byte-for-byte), `cd desktop && npm run typecheck-client`, `bun test apps/macos/test` (594
pass), `bun run typecheck`, `bun scripts/cursor-parity-check.ts` (340 keys, 0 mismatch),
`node scripts/ci-validate.mjs`. The two `0021` needles that pinned the old `commandId` wiring were
replaced by needles for the hosted panes, and the manifest digest for 0021 was re-cut with it.

## Not verified

- **The pixels.** `view_image` answered HTTP 429 again, on the sky screenshot and on a window
  capture, so the geometry above is measured DOM/AX and was never looked at. Colour, type and
  spacing of the two panes are unmeasured.
- The File pane's content is the base's Files **empty state + Search Files**, not a file tree; the
  `IExplorerService` note above is the reason the tree is not duplicated into the panel.
- The Changes pane shows the base's changes **view** (the list the detail panel shows), not the
  multi-diff editor the base renders in the editor area. Which of the two the reference's panel
  puts under its `Changes` entry is still open - the AX capture lists the entry, not its content.
- A window with a real session and real changes: this run had no session (the base's agent-host
  banner was up), so the Changes pane rendered its empty state. It is the same view the base uses,
  but "a session's changed files listed inside the panel" is not on-screen evidence yet.
- **Who owns the Changes surface when the base's docked detail panel is also visible.** The base's
  single-pane layout keeps a docked auxiliary bar that can show the same Changes view container,
  driven by `SinglePaneDetailPanelCoordinator` and the lifecycle strategies; this run's detail
  panel was hidden (`display: none`), so the panel's pane was the only one on screen. If both are
  ever visible at once there would be two live changes views, which is the state the plan's SSOT
  rule exists to prevent - decide which one owns it before treating the panel as final.
- Pre-existing and out of scope: the Agents window shows the base's `Error: The Agent Host failed
  to start` banner in this instance, as it did in log directories written before this change.
