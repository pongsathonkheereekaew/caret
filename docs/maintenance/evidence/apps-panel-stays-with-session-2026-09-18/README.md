# The Apps panel stays the pane while a session is open (2026-09-18)

Item 44 of `docs/maintenance/CEDIA-PLAN.md`. Nothing here is new measurement of the reference:
the reference's right side and Caret's strip were measured earlier
([`../cursor-agent-window-architecture-2026-09-15/`](../cursor-agent-window-architecture-2026-09-15/README.md),
[`../apps-panel-session-state-2026-09-18/`](../apps-panel-session-state-2026-09-18/receipt.json)).
This receipt records the defect state, the change, and the live packaged-build states that close it.

## The defect

The Agents window's right pane is the Caret Apps panel - one panel whose strip carries the
reference's four pane entries (`Changes · Browser · Terminal · File`) plus `Open new tab menu`.
Caret's strip is that pane's only tab group (`CEDIA-PLAN.md` section 3.2 records the decision to
keep it, with the base tab group hidden), and Terminal only exists there: the sessions workbench
has no terminal editor, so `Terminal: Create New Terminal in Editor Area` creates nothing.

The window's own session tabs - the managed Changes multi-diff and the empty Files placeholder -
are opened into that same single editor group (`SINGLE_PANE_SCENARIOS.md`), and
`agentHomeUtility.contribution.ts` opened the panel only while the group was empty. Opening an
existing session therefore replaced the panel with the base tab strip, so the window read as the
build without the terminal. Measured screenshots and AX trees of that state are in
[`../apps-panel-session-state-2026-09-18/`](../apps-panel-session-state-2026-09-18/receipt.json).

## The change

- `patches/desktop/0021-caret-agent-home-utility.patch` (the patch that creates the contribution):
  the panel now claims the pane whenever the group's active tab is one of the window's own session
  tabs, or the group has no tab at all. It is opened under `suppressEditorPartAutoVisibility()`, so
  claiming a pane never reveals one, and it is skipped while the editor area is hidden (a
  detail-only collapse, or the whole side pane shut) and while the classic layout is in use. A tab
  the user opened - a real file, a search editor - is left alone, and `Show Apps` records a user
  hide so the rule does not silently undo it.
- `patches/desktop/0039-caret-apps-panel-is-not-a-session-tab.patch` (new):
  `singlePaneDockedTabsCoordinator.ts` counts the group's session tabs without the panel when it
  decides whether to open the managed Changes/Files defaults, so a session that opens into a group
  whose only tab is the panel still gets its managed tabs.

## Verification (packaged build)

Build loop: `npx gulp vscode-darwin-arm64-min` (3.15 min) then
`CARET_HOST_NODE=~/.caret-tools/node-v24.18.0-darwin-arm64/bin/node bun run package:mac`, launched
with `bun scripts/launch-caret-personal.ts`. `bun run check:packaged` is green: patch set
`74c6ca5cbb28`, 36 patches, base `ea1912fd`, both shell hashes and the extension hash matching the
stamp.

Each state below is a real screenshot plus an AX tree from the running window; the `.ax.txt` files
are the raw trees, and the element numbers are theirs.

| State | Evidence | Right pane |
|---|---|---|
| cold launch (window reopened after a relaunch) | `cold-launch.png`, `cold-launch.ax.txt` | strip: `Changes`, `Browser`, `Terminal`, `File`, `Open new tab menu` |
| empty draft (`New Chat`) | `draft-new-chat.png`, `draft-new-chat.ax.txt` | same strip over the four cards `Changes`/`Browser`/`Terminal`/`File` |
| existing session opened from the sidebar | `session-open-existing.png`, `session-open-existing.ax.txt` | same strip, chat in the centre column |
| `Terminal` clicked in that session | `session-terminal-open.png`, `session-terminal-open.ax.txt` | `tab (selected) zsh`; the screenshot shows the live prompt `pond@CEDIA-M cedia %` and the AX tree carries the terminal field `Terminal 3, zsh` |

The last row is the one the defect was named for: the four-pane strip and a real `zsh` tab exist
in the right panel while an existing session owns the editor group, instead of the base tab strip
whose `+` menu offered only `Browser` and `Search`.

Also green in the same revision: `bun run test` 881 pass / 0 fail (97 files),
`bun run typecheck` clean, `bun test apps/macos/test/desktop-patch-set.test.ts` 0 fail,
`bun test apps/macos/test/ide-native-workbench.test.ts` 67 pass (the patch-text pin for `0021`),
`node scripts/ci-validate.mjs` CI-OK.

Not verified here: the `Hide Apps` / detail-only transitions are unchanged by this work and were
not re-measured; the classic (non-single-pane) layout keeps the old behaviour by construction.
