# Caret desktop defaults

Base: `ea1912fd6a05b80a56b2ad9b955075211deea521` (retained Caret Code-OSS fork).

`manifest.json` lists every patch and its digest; `scripts/prepare-desktop.ts`
verifies the base revision and each digest before applying.

`0001-caret-startup-defaults.patch` changes only initial settings: disable upstream
AI surfaces, start without the VS Code welcome editor, and disable experimental
Copilot onboarding. These remain settings, not policy overrides. The Caret task
extension supplies the shell, including a non-executing Restricted Mode surface.
Workspace trust enforcement remains enabled.

`0002-caret-agents-window-menus.patch` drops Selection, Go, Run and Terminal from
the menu bar while the `caret.agentsWindow` context key is set. The reference
agent window shows Cursor/File/Edit/View/Window/Help, and the pinned Code-OSS
already uses the same mechanism to hide Run in its own sessions window. The key
is set by the Caret extension when the window shows the Agents shell
(`CARET_AGENTS_WINDOW_CONTEXT` in `apps/macos/src/workbench-mode.ts`), so the IDE
window keeps the editor menus. `apps/macos/test/ide-native-workbench.test.ts`
pins the key, the patch text, and the manifest digest together.

**Retired.** The base Agents window registers its own menu set now, so hiding
editor menus by context key is no longer needed: the patch file and its manifest
entry are gone, and the context key it depended on was removed with it.

`0003-caret-agents-window-proposals.patch` is Caret's product identity for the
Agents window: it allows the built-in `caret.caret` extension to use the proposed
`chatSessionsProvider` API, and it removes the Copilot product identity —
`defaultChatAgent` (the key that made the sessions window run Copilot's
welcome/sign-in flow), the Copilot entries in `trustedExtensionAuthAccess`, and
`GitHub.copilot-chat` from `builtInExtensionsEnabledWithAutoUpdates`. After this
patch `product.json` contains no Copilot references. It is a prerequisite for
`docs/maintenance/CARET-PLAN-2026-09-14.th.md` step S1 and has no effect until the
next Code-OSS build. The 0002 menu patch is scheduled for retirement in that same
plan: the base Agents window registers its own menu set, so hiding editor menus by
context key stops being necessary once the Agents window is the real surface.

`0004-caret-agents-entry.patch` is the drift that used to live only in the
checkout: it routes the workbench "Open Agents" action to the Caret extension
instead of the base Agents window. It exists so the tree has no unreviewed
modification. Step S1 of `docs/maintenance/CARET-PLAN-2026-09-14.th.md` inverts
this patch (route to `workbench.action.openAgentsWindow` and delete the comment
that calls that window Copilot's) once the Copilot harness is gone and the Caret
provider serves the window.

**Retired.** Step S1 landed: `workbench.action.openAgentsWindow` is the route
again, so the patch file and its manifest entry are gone.

`0005-caret-remove-copilot-sessions.patch` stops the sessions workbench (the
Agents window) from loading the Copilot chat session provider in both the desktop
and web entry points. After this patch nothing imports
`copilotChatSessions.contribution.js`, so the window no longer offers
`Session Type: Copilot`; Caret's own provider is the only session source once
step S2 lands. The Copilot harness directories are still on disk at this step —
removing the registration before deleting the code keeps every intermediate tree
buildable.

`0006-caret-unwire-agent-harnesses.patch` removes the agent-harness registrations
themselves: no Copilot/Claude/Codex provider is registered in `agentHostMain` or
`agentHostServerMain`, `providerConfigurations` is empty, and the Copilot BYOK
proxy, Claude/Codex proxy services, pending-edit content provider and the Copilot
API service wiring in `agentHostServices`/`agentHostBootstrap` are gone. Verified
with `npm run typecheck-client` (0 errors) and the import resolver check. The
harness directories are still on disk; deleting them (and the sessions pickers
that import the Copilot pickers) is step S1b.

`0007-caret-drop-harness-pickers.patch` removes the last production references to
the Copilot harness: the Copilot-schema picker family is gone (mode, permission,
approval, agent pickers plus their mobile variants), `sessionPluginBundler.ts`
declares the discovery shape it used to import from the Copilot module, and the
remote-agent-host contribution no longer loads the deleted picker.

Patch files `0008`-`0015` are the plan's S1-S4 work; their intent is recorded in
the evidence receipts under `docs/maintenance/evidence/` rather than here.

`0016-caret-agents-window-cursor-chrome.patch` closes three S4 rows from section 3
of `docs/maintenance/CARET-PLAN-2026-09-14.th.md`, all inside the Agents window:
the sidebar pane no longer renders a "Sessions" title the reference does not have
(the element stays as the flex spacer the header actions and find widget use); the
`Run` split button and its permanently disabled `Run Task is not available…`
placeholder leave `Menus.TitleBarCenterRight` (the command stays in the palette
and on F5); and the Agents-window model picker finally reports
`isSessionsWindow: true`, without which the core picker treated an empty catalog
as a Copilot sign-in gate and the chip read "Models, sign in to use Copilot". The
patch touches only `src/vs/sessions/**`, and `apps/macos/test/ide-native-workbench.test.ts`
pins its content and digest against `manifest.json`.

`0017-caret-agents-app-panel-chrome.patch` gives the right-hand app panel the names
section 3.2 uses: the single-pane editor-title controls become Enter Full Screen /
Exit Full Screen / Hide Apps, the empty-group toolbar's close action becomes Hide
Apps, and `browser/media/workbench.css` hides the editor watermark for this window
only (the reference panel has none). The CSS targets the watermark element rather
than its wrapper because the wrapper also hosts the panel's own toolbar.

`0018-caret-agents-composer-voice-copy.patch` renames the composer microphone to
`Start voice input`, the reference's name for that control. The localize id is
unchanged, so the dictation wiring and hover copy are unaffected.

`0019-caret-customize-in-sidebar.patch` is the one Caret patch that edits
`src/vs/workbench/**`, so it is deliberately a single configuration default:
`chat.agentSessions.customizationEntryPoints` goes from `product.quality !== 'stable'`
to `false`. That setting's own description is the choice between the new-session
composer and the Agents Window sidebar; section 3 of the plan lists `Customize` in
the sidebar, so Caret selects the sidebar placement. Every consumer of the setting
lives under `src/vs/sessions/**`, so the IDE window is untouched. It is recorded in
`docs/maintenance/evidence/s4-customize-sidebar-2026-09-14/`.

`0020-caret-agents-pet-unmounted.patch` stops the chat pet from being mounted at
all in the Agents window while the easter egg is off. Registering a pet host is
what creates the pet (its DOM, listeners, timers and accessibility nodes), and the
coordinator only parks an already-created pet on unregister, so the three sessions
call sites are gated on `sessions.developerJoy.enabled` instead: `chatView.ts` ANDs
the setting into the host-preference observable, `newChatInput.ts` registers from an
autorun that tracks the setting, and `newChatWidget.ts` only mounts the aquarium
toggle while it is on. No core chat file is touched, so the IDE window keeps its own
pet behaviour.

`0021-caret-agent-home-utility.patch` is the Agent Home visual sprint, and it now
carries the Apps panel's behaviour too. The empty home used to be a bare editor
group - a blank canvas with `Add Tab` and a close control at roughly 40% of the
window. This patch puts the reference's right utility area there instead: a Caret
`EditorPane`/`EditorInput` pair draws the panel's single strip and, beneath it, the
four app tiles of the reference (Review, Browser, Terminal, File). The strip entry and
`+` share one path, so an entry never opens its surface somewhere else: Review and File
run the commands Caret already has (`workbench.action.agentSessions.newChangesTab`,
`workbench.action.quickOpen`), while Browser and Terminal are hosted by the panel
itself - `ITerminalService.createTerminal` plus `ITerminalInstance.attachToElement` put
a real terminal in this pane, **one tab per instance**, and never reveal the bottom
panel.
`+` is the reference's `Open new tab menu` - it picks Review / Browser / Terminal /
File - and Browser is hosted here too: the pane resolves an
`IBrowserViewModel` itself and pushes the overlay bounds from the tab's own
container on every layout (`model.layout`, `model.setVisible`), so the page is
fitted to the pane instead of spilling past it. The tab carries its own address bar
(back / forward / reload / address), so opening Browser is usable immediately.
`+` opens that same list as a context menu anchored to the button. The tab state and
the instances live in a window-scoped singleton (`appsPanelModel.ts`), not in the
pane: the pane attaches their DOM while it is on screen and detaches it when it goes
away, so a pane the layout closes and re-creates does not take the tabs with it.
The strip also carries a `Toggle Pinned Summary` control that reads the real active
session from `ISessionsService.activeSession`. Because the
panel draws the pane's only strip, the host group's title strip is suppressed while
the panel is the editor that group shows - two strips put the group's tabs
(Browser) one row above the panel's tabs (a terminal), which is the misalignment
this replaces. A `caret.agentHome.showApps` action supplies the `Show Apps` half the
base lacks, so a browser or file tab is not a dead end. The same contribution sizes
the three columns to the reference profile (sidebar 255px, utility 22.5% of the
window - `0022` replaces the fixed 255px sidebar with the reference's 15.625% share)
and re-applies that share only when the container *size* changes, the CSS narrows
the composer to the reference's 608px centred card, and the instance containers
reuse the upstream `terminal-overflow-guard`/`terminal-editor` classes so the
wrapper and xterm are sized by the terminal contribution's own CSS. Everything is
Sessions-window scoped.

`0022-caret-agent-home-chrome-navigation.patch` continues that sprint on the window
chrome and the sidebar. The `SessionsTitleBarContribution` is no longer mounted, so
the wide `Show Sessions` pill leaves the middle of the Agents Window title bar (that
contribution is only loaded by the Sessions workbench, so the IDE never had it). The
sidebar gains the reference navigation: full-width `New Chat`, `Search`,
`Automations` and `Customize` rows, a `Projects` section, a `Repositories` section
built from the open workspace folders - with a `New Project` row and a repository
filter whose toggle reveals an input that hides the rows that do not match. The
sidebar ends there, because the reference capture does: an earlier draft also had a
`Getting Started` card and a local profile row with Settings, and both were dropped
once the real reference screenshot arrived and the user chose it over the brief.
Every row runs an existing command
(`workbench.action.sessions.newChat`, `sessionsViewPane.find`,
`sessions.customView.automations`, `sessions.customization.overview`,
`workbench.action.files.openFolder`, `workbench.action.openSettings`). The base
sidebar header (the small New Chat pill plus filter/find icons) and the detached
`Customizations` footer are removed from the DOM, and the column shares become the
reference proportions so the sidebar and utility dividers land where the reference
capture measures them - sidebar 15.625% and utility 22.51% of the window, i.e. 320
and 1587 of the reference's 2048 captured pixels. It is five files: three new
(`agentHomeNav.ts`, `agentHomeNav.contribution.ts`, `media/agentHomeNav.css`) and
the two registration/entry files the chrome changes live in
(`contrib/sessions/browser/sessions.contribution.ts`, `sessions.desktop.main.ts`).
Its stylesheet also owns the "no second strip" rule for the Caret Apps panel (see
`0021`): the group's title strip is hidden while that panel is the shown editor, so
the panel's own strip is the only one in the pane.

`0023-caret-agent-home-composer-starters.patch` gives the empty Agent Home the
starter rows the reference shows under the composer. Caret already owns that surface:
`INewSessionComposer` renders prompt options and inserts the chosen prompt into the
input with its placeholder selected. In the base those rows only appear from the
`sessions.onboarding.newSessionViewV3` onboarding tour, which sits behind a Copilot
experiment flag and a "no recent sessions" trigger, so the Agents Window never showed
them; this attaches the controller directly. The three starters are the base's own
localized strings (implement a feature, fix a bug, fix CI), exported from the file
that already owned them rather than copied, and the stylesheet also takes the card to
the reference's 104px height and puts the starters below the card as one line each.
Nothing under `src/vs/workbench/**`.

`0024-caret-agent-home-context-row.patch` adds the two chips the reference puts beside
the Agent Home workspace picker. The branch chip reads
`session.workspace.folders[0].gitRepository.branchName` - the same value the base's own
session actions read - and clicking it runs the base's real
`sessionsViewPane.agentHost.copySessionBranchName` command, so the chip copies the
branch rather than implying a selection Caret cannot make; no chip is rendered when
there is no branch. The runtime chip reads "This Mac" only while no remote agent host is
connected, which is the truthful reading of the single execution target Caret offers,
and it is a label rather than a button because there is no target picker to open. The
composer rebuilds the picker row on state changes, so the chips are re-rendered from a
guarded MutationObserver as well as from the session autorun. Nothing under
`src/vs/workbench/**`.

`0025-caret-agents-titlebar-regions.patch` places the Agents window title bar controls
where the reference has them: session navigation after the sidebar toggle in the left
section, and the "IDE" button before the panel and side-panel toggles in the right
section. `titlebarPart.ts` mounts the navigation and Open-in-VS-Code toolbars into the
left and right sections, and `titlebarpart.css` orders them (sidebar toggle 1 then
navigation 2; IDE 1, session actions 2, right layout 3). Both files are the same
decision, and the mount half had been sitting uncommitted in the desktop checkout with
no patch covering it - the only two uncovered files in a scan of all dirty sessions
files - so this patch also makes the placement reproducible from the stack.

`0026-caret-agents-no-bottom-panel.patch` removes the Agents window's bottom panel.
The window's terminal is a tab in the Apps panel on the right, so the bottom part was
leftover chrome that the panel toggle (cmd+J) could still open as an empty strip with
Output and Terminal in it. The workbench keeps the part in its layout bookkeeping -
every other call site still resolves - but `_effectiveVisible` never reports the panel
as visible, `setPanelHidden` refuses to show it, and a saved "visible" is not restored
on load. Building the window, opening a terminal from the Apps panel and pressing
cmd+J all leave the panel at height 0.

## Removals

`manifest.json` also carries a `removals` list: whole trees and files Caret does
not ship (the `copilot`/`claude`/`codex` harness directories, the agent-host test
tree, the Copilot chat-session provider, and the picker files above). They are
deleted by `prepare-desktop.ts` instead of living in a multi-megabyte deletion
patch, so the list stays reviewable and every path is still tracked. Restoring the
pinned checkout and re-running `bun scripts/prepare-desktop.ts` reproduces the
Copilot-free tree; that state passes `npm run typecheck-client` with 0 errors.

Not yet removed: 15 Copilot-named helper files that are not part of the harness
(`copilotCliConfig`, `copilotHome`, `copilotManagedSettings`, `copilotToolIds`,
slash-command and prompt-syntax compat helpers). They register nothing and gate
nothing; they are naming/identity debt for a later S1 follow-up.

Run `bun scripts/prepare-desktop.ts` before the pinned Code-OSS package task;
`bun scripts/build-caret.ts --portable --desktop` also applies this patch and the
tracked Caret extension/icon overlay. The script verifies base and patch digest,
accepts an already-applied patch, and refuses a conflicting checkout.

Then build `vscode-darwin-arm64-min` from `desktop` with the installed Node 24
runtime, followed by `CARET_HOST_NODE=/absolute/path/to/node bun run package:mac`.
The latter replaces the generated Caret extension, copies the packager's filtered
Tree-sitter WASM assets to their real filesystem lookup path, and locally ad-hoc
signs the app. This is not Developer ID signing or notarization.
