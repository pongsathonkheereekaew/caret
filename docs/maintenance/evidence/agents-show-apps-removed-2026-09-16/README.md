# The Agents window's title-bar "Show Apps" icon is gone (2026-09-16)

The user reported the second icon in the top-right row ("Show Apps") as not working.
Measured on the packaged app (CDP): the control was a **no-op**.

## What the control did

`ShowAppsAction` (`caret.agentHome.showApps`, patch `0021`) was appended into
`Menus.TitleBarRightLayout`. Its `run()` closes the panel when the group's active editor
is `AgentHomeUtilityInput`, otherwise it opens that input in the group. Measured state
across three consecutive clicks on a window whose panel was already the group's editor:

```
initial       panel present, tabs [Changes, Apps]
after click 1 panel present, tabs [Changes, Apps]
after click 2 panel present, tabs [Changes, Apps]
after click 3 panel present, tabs [Changes, Apps]
```

The editor it would "open" is already in the group, so the only branch that can act is
the close branch - and that branch needs the Apps editor to be the *active* editor, which
it is not while a hosted pane (Changes/Browser/Terminal/File) or a chat holds the group.
So in the common state the icon does nothing at all.

The reference has no such control: its panel header carries `Open new tab menu`,
`Enter Full Screen` and `Hide Apps` (AX capture
`evidence/cursor-agents-ax-2026-09-14/cursor-agents-ax-tree.txt`, line 91), and no
title-bar "Show Apps" appears anywhere in the capture.

## The change

| artifact | change |
| --- | --- |
| `patches/desktop/0021-caret-agent-home-utility.patch` | the `MenuRegistry.appendMenuItem(Menus.TitleBarRightLayout, …)` block is removed and the file's now-unused imports (`Codicon`, `Menus`, `ContextKeyExpr`, `IsAuxiliaryWindowContext`) go with it. The action itself stays, as a command (`f1: true`), with a comment that records why it is not a title-bar control |
| `patches/desktop/manifest.json` | 0021's digest re-pinned (the patch is the file's owner: 0021 **creates** `agentHomeUtility.contribution.ts`, so a follow-up patch could not pass its own reverse-check - plan section 6) |
| `patches/desktop/README.md` | the 0021 paragraph now says the action is a command only, and why |
| `apps/macos/test/ide-native-workbench.test.ts` | the 0021 needle test keeps asserting `caret.agentHome.showApps` exists and adds `not.toContain("Menus.TitleBarRightLayout")` |

Recovery paths after removal: the command stays in the Command Palette
(`Agents: Show Apps`, `f1: true`, verified open) and the strip's `Apps` tab returns to
the panel when something else holds the group.

## Verification

| gate | result |
| --- | --- |
| `bun scripts/prepare-desktop.ts` | 29 patches / 18 removals, all digests and reverse-checks pass |
| `bun test apps/macos/test/desktop-patch-set.test.ts` | applies in manifest order, reproduces the checkout |
| `cd desktop && npm run typecheck-client` | 0 errors (with the unused imports gone) |
| `bun run typecheck`, `check:cursor-parity`, `ci-validate` | clean; parity 340 keys / 0 mismatches |
| `bun run test` | 749 pass, 1 fail - `menus-contract.test.ts` needs `rg` on `PATH` (environmental, pre-existing) |
| on screen, after | CDP: `[aria-label="Show Apps"]` = 0 anywhere in the window; the right layout container has no visible items; the panel is present with its four launchers `Changes · Browser · Terminal · File`; screenshot shows the top-right row as `IDE · Toggle Side Panel` |

Build loop: `node build/next/index.ts bundle --minify`, copy `desktop/out-vscode/.`
into the packaged `app/out/`, `CARET_HOST_NODE=… bun scripts/build-caret.ts --package`.

## Not verified / still open

- `Hide Apps` and `Enter Full Screen` (patched by `0017` to the reference's wording) sit
  in the editor group's title strip, which the panel's own strip suppresses
  (`display: none`). The reference shows both **inside the panel header**, so our panel
  strip still lacks two of the reference's four header controls. The removed icon is not
  a substitute for them; this is a separate gap.

## The "@omp" report - what was found

The user also asked why the chat box shows `@omp` when OMP is the only agent. Two code
paths can render it, and both trace to one value: the session/participant handle in
`apps/macos/package.json` is literally `omp` (`chatSessions[0].name`, and the same on the
participant), and the base renders handles with an `@` leader.

1. **A chat locked to our session type shows Copilot's delegation copy.** `chatView.ts`
   locks the widget to the session type's contribution; when the contribution has no
   `welcomeTitle`/`welcomeMessage` the widget falls back to
   `"Delegate to {0}"` / `"This chat session will be forwarded to the {0} coding agent
   where work is completed in the background."` with `{0} = "@omp "` - a background-agent
   promise Caret does not make. New chats created for the type would take this path.
2. **Mention completions** render participants as `@name`. Typing `@` in the Agents
   composer today actually lists the base's Copilot **tools** (`@agent`, `@browser`,
   `@askQuestions`, `@runSubagent`, …), which is the same class of problem: a Copilot
   concept rendered over a harness that does not implement it.

Related finding, measured while looking: the sessions the window lists are bound as
`caret://session/<id>`, and `getChatSessionType()` returns the URI's **scheme** - so their
type is `caret`, while our contribution's type is `caret.omp`. `getChatSessionContribution('caret')`
therefore misses, the widget stays **unlocked** (every listed session shows the base
welcome `Build with Agent`), and our contribution's own copy, placeholder and
type-specific capabilities never apply. Chats created *for* the type
(`getNewChatSessionResource('caret.omp')` → scheme = type) are the ones that lock.

Not reproduced end-to-end: no `@omp` string was found on screen in any state this pass
could drive (every session, the Agent Home, a fresh window). A screenshot of the state
where the user saw it would pin the surface; the two paths above are the candidates, and
both are fixable the same way (give the contribution its own welcome copy, and decide the
scheme/type split).
