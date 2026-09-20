# The Agents window's top-right "connection" icon is gone (2026-09-16)

The user reported an unusable icon at the top right of the Agents window ("right panel,
connection"). CDP on the packaged app identified it exactly: an
`li.action-item.tunnel-host-toggle` at 1386,7 with aria-label **"Allow connections from
other machines"**, drawn beside our own `Show Apps` control.

## What the control was

`SessionsTunnelHostTitlebarContribution`
(`src/vs/sessions/contrib/tunnelHost/electron-browser/tunnelHost.contribution.ts`)
appends an "Allow Remote Connections" toggle (`Codicon.radioTower`) into
`Menus.TitleBarRightLayout`, gated
`ChatContextKeys.enabled && IsSessionsWindowContext && !IsAuxiliaryWindowContext`, and
registers a custom view item for it. The command behind it runs
`executeToggleRemoteConnections(..., { authenticationProviderId: 'github' })` - a
GitHub-authenticated dev tunnel. This fork ships no GitHub sign-in (S1 removed the
Copilot layer it belonged to), so the control could only open a flow it cannot finish.
Cursor's window has no such control (`section 3`: header is `IDE · Chat actions · Show
Apps`), so removal is also the parity-correct direction.

## The change

| artifact | change |
| --- | --- |
| `patches/desktop/0031-caret-agents-no-remote-connections.patch` | new patch (a base file no earlier patch touches, so it stands alone): the menu item's `when` becomes `ContextKeyExpr.false()` with a Caret comment, and the three imports that only the old gate used are removed |
| `patches/desktop/manifest.json` | 0031 entry with its sha256 |
| `patches/desktop/README.md` | a paragraph next to the 0029 one explaining why the control is unreachable rather than deleted |
| `apps/macos/test/ide-native-workbench.test.ts` | new needle test: the old `when` line is removed, the false expression is present, one `diff --git`, path scoped to `src/vs/sessions/`, digest matches the manifest |

The declaration and its view item stay registered (same shape as 0029): the type
checker and the base's wiring keep compiling, and the control never appears.

## Drift found and repaired while cutting the patch

`bun scripts/prepare-desktop.ts` refused to run before this slice:

```
Caret desktop patch integrity mismatch: 0003-caret-agents-window-proposals.patch
```

`0003` and `0010` had each been re-cut a second time in the working tree after the
manifest digest was updated (HEAD is consistent; the second re-cut never reached the
manifest). Digests for both now match the patches on disk, and the full set verifies:
`prepare-desktop` reports **29 patches / 18 removals** and
`apps/macos/test/desktop-patch-set.test.ts` applies them in manifest order and
reproduces the checkout.

## Verification

| gate | result |
| --- | --- |
| `bun scripts/prepare-desktop.ts` | 29 patches / 18 removals, every digest and reverse-check passes |
| `bun test apps/macos/test/desktop-patch-set.test.ts` | applies in manifest order, reproduces the checkout |
| `cd desktop && npm run typecheck-client` | 0 errors (with the unused imports gone) |
| `bun run typecheck`, `ci-validate`, `check:cursor-parity` | clean; parity 340 keys / 0 mismatches |
| `bun run test` | 749 pass, 1 fail - `menus-contract.test.ts` shells out to `rg`, which this machine does not have on `PATH` (environmental, pre-existing) |
| on screen, before | CDP: `.tunnel-host-toggle` present at 1386,7 with aria-label "Allow connections from other machines"; screenshot shows the radio-tower glyph beside `Show Apps` |
| on screen, after | CDP: `tunnel-host-toggle` 0, `codicon-radio-tower` 0, no aria-label containing "connection" anywhere; the row reads `Toggle Side Panel · Show Apps · IDE (⇧⌘A)`; screenshot attached |
| IDE window | launched with a folder: `package.json — Caret`, status bar and explorer present - the change is scoped to `src/vs/sessions/**`, which only the Agents window loads |

Build loop used: `cd desktop && node build/next/index.ts bundle --minify`, copy
`desktop/out-vscode/.` into the packaged `app/out/`, then
`CARET_HOST_NODE=…/node-v24.18.0-darwin-arm64/bin/node bun scripts/build-caret.ts --package`.

## Not verified

- No real-mouse click was made on the removed control (it is absent; CDP DOM and a
  screenshot are the evidence). The plan's rule that anything drawn over a native view
  needs real input does not apply to a title-bar toolbar item, which is DOM only.

## Audit: the rest of the Agents window chrome (same revision)

Inventory taken with CDP at the same time; every visible control, its owner, and
whether the product can honour it.

| region | control | owner | state |
| --- | --- | --- | --- |
| title bar left | Toggle Side Bar ⌘B | base layout action | works |
| title bar left | Go Back / Go Forward One Session ⌃- | base sessions nav | works (Forward disabled until a forward stack exists) |
| right of centre | IDE ⇧⌘A | Caret (patch 0025) | opens the editor window |
| right | Toggle Side Panel ⌥⌘B | base layout action kept on purpose | works; reference has no such control (recorded deviation) |
| right | Show Panel ⌘J | base | registered but hidden (`0025`/`0026`: the bottom panel never opens) - DOM 0×0 |
| right | Allow Remote Connections | base sessions contribution | **removed today** (patch 0031) |
| right | account widget | base sessions contribution | already hidden (patch 0029) |
| sidebar | New Chat / Search / Automations / Customize + Projects / Repositories | Caret React surface (`0022`/R3) | mounted, rows at 8,39-135; sections Projects/Repositories |
| sidebar list | base session groups `Automations`, `Chats` (empty: "No chats"), project `caret` | base sessions list | the empty `Chats` group is a base artifact the reference does not have; a setting (`sessions.list.showEmptyDefaultGroups`) controls it |
| Apps panel | Changes / Browser / Terminal / File rail, `Open new tab menu`, `Toggle Pinned Summary` | Caret React surface (`0021`) | verified working with real mouse in `apps-panel-changes-file-panes-2026-09-16` |
| composer | Add Context…, Models (OMP catalogue), Send | base + Caret wiring | works (model chip reads `DeepSeek V4.1 Flash (Command Code)`) |
| composer | **Configure Tools…** | base chat input | opens a picker over Copilot's built-in tool set ("13 Selected", "applied globally for all chat sessions that use the default agent") - OMP owns execution, so nothing here reaches the harness: misleading control |
| composer | **Permission picker** ("Default permissions") | base chat input | offers `Default permissions / Allow all / Autopilot (Preview)` - Copilot permission semantics; Caret's approvals/questions come from OMP (`section 4`): misleading control |
| composer | **Agent** mode picker | base chat input, fed by our `modes` | opens `Agent / Configure Custom Agents…`; whether modes change OMP behaviour is unverified, and "Configure Custom Agents" has no surface here |
| composer | Dictate (Speech to Text) ⌘I | base | unverified; depends on the speech extension |
| message rows | Copy / Helpful / Unhelpful / Retry / Restore checkpoint / Fork conversation | base chat renderer | checkpoint, fork and feedback depend on agent-host/feedback services the fork does not wire - unverified, likely inert |

The three composer pickers are the same class of problem as the icon that was removed:
the base renders Copilot-chat concepts (tools, permission modes, custom agents) over a
harness that does not implement them. They need a decision each - wire to OMP, hide, or
show disabled with a reason (`section 5`) - before the composer can be called
parity-clean.
