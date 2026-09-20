# The Apps panel's strip is the reference's pane switcher (2026-09-16)

Item 3 of the parity queue, first slice. The reference's strip is not a row of "open this app"
buttons: it is a pane switcher - picking a pane shows the one that is there and marks it - while
`+` is what opens an additional instance. Caret had one path for both, last changed to "every entry
opens its own instance" while chasing the *other* bug (the menu opening behind the hosted page).
Both complaints were real and they are not the same thing.

## The change

`runLauncher(launcher, mode: 'reuse' | 'new')` now encodes the split, and the three call sites name
which half they are:

| caller | mode | why |
|---|---|---|
| the strip's entries | `reuse` | the pane switcher: show the open pane, or open one if there is none |
| the `+` menu | `new` | the instance opener, always |
| the empty-state cards | `new` | nothing is open yet, so the two are equivalent; the card means "start this" |

Going through one method is the point: the two halves cannot drift on what "Browser" means, which is
what they did. The rail's active marking already existed (`launcherRail.update(...active: entry.kind
=== activeTab?.kind)`) and now has something to mark.

## Verification (packaged app, CDP)

| step | result |
|---|---|
| fresh panel, click the rail's `Browser` | `tabs: ["Browser*"]`, rail marks `Browser` active |
| click the rail's `Browser` again | `tabs: ["Browser*"]` - still one tab: it switched to the open pane instead of adding one |
| `+` → `Browser` | `tabs: ["Browser", "Browser*"]` - a second instance, newest active |

Also green: `npm run typecheck-client`, `bun scripts/prepare-desktop.ts` (28 patches / 18 removals),
`bun test apps/macos/test` (594 pass), with the `0021` needles now pinning the signature and both
call sites.

## Not verified

- The *visible* pane after a switch: the check read the tab state and the rail's active mark, not
  the native page overlay. A real-mouse pass (the method that caught the `+` menu bug) has not been
  run for this change.
- **`changes` and `file` still open editor-group tabs rather than living in the panel**, which is
  the rest of item 3: they are `workbench.action.agentSessions.newChangesTab` and quick open today,
  so making them panes is a structural change to what the strip switches between, not a wiring fix.
