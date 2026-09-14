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
