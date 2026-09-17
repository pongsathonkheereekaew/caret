# The Agents window follows the user's theme, and the desktop patches match the tree (2026-09-15)

Two pieces of work that were stuck in the same place: the checkout had moved past the patch set, and
the second window had a theme of its own.

## 1. The patch set no longer described the tree

`bun scripts/prepare-desktop.ts` was **red**. It proves "already applied" by reverse-checking each
patch on its own, so a patch whose post-image is not in the checkout fails by construction. Three
things had drifted in the working tree after the patches were written:

| drifted file | what the checkout had |
|---|---|
| `src/vs/sessions/contrib/home/browser/agentHomeUtilityEditor.ts` | the strip entries open an instance of their own (`runLauncher(launcher)`); `0021` still carried the earlier pane-selector shape (`reuseExisting`) |
| `src/vs/sessions/contrib/home/browser/media/agentHomeUtility.css` | the Agents window's context-menu surface |
| `build/next/index.ts` | `inlineReactPlugin()` + `process.env.NODE_ENV`, with no patch at all |

`0021` and the new `0028` were re-cut from the working tree rather than the tree being reverted to
the patches: the checkout is the newer state, and the strip semantics it carries (a rail click adds
an instance, `+` opens the menu of apps) are the ones verified on screen below.

**How a patch is re-cut matters.** `git apply` writes the worktree, not the index, so `git diff`
after applying the earlier patches still compares against the base commit - a base-relative patch.
That stays invisible until a *shared* file is involved: `sessions.common.main.ts` is edited by
`0005` too, so a base-relative `0021` re-removes an import `0005` already removed and the re-apply
fails. The fix is `git apply --index` for the preceding patches, so the diff is taken against the
state `0021` will actually be applied to. Everything else in the set is base-relative because no
earlier patch touches those files.

## 2. The Agents window kept its own theme

Two separate things had to be true at once, and the first answer was wrong.

**Why the theme was not registered.** The Agents window has its own extension enablement, and
`ExtensionEnablementService._isDisabledBySessionsWindow` runs `canExecuteOnSessionsWindow(manifest)`,
which returns `false` for any manifest with a `main`/`browser` entry. Catppuccin ships
`dist/main.cjs` next to its `themes` contribution, so it is disabled in that window, its declarative
theme is never registered, and `workbench.colorTheme` quietly resolves to the stock theme. The
supported override is the setting upstream ships for exactly this:
`extensions.supportAgentsWindow` ("Extensions using `true` will be enabled in the Agents window even
when they would otherwise be disabled").

**Where the window reads its settings.** The Agents window is pinned to the internal `agents` profile
(`AGENTS_WINDOW_PROFILE_ID`; upstream refuses to update it), and it looked like the profile's own
`settings.json` was the missing piece - so the extension wrote the theme keys and the allow-list
there. The window stayed on the stock theme with the override sitting in that file. The reason is in
upstream's profile flags: `AGENTS_WINDOW_PROFILE_FLAGS.settings` is `true`, so the profile's
`settingsResource` is *the default profile's* settings file, and
`profiles/builtin/agents/settings.json` is read by nobody.

What the window does read is its own workspace file - `agentSessionsWorkspace` =
`agent-sessions.code-workspace` in the user data home, the document the sessions workbench already
writes `chat.disableAIFeatures` into. Writing the keys there resolved the theme; writing them only
to the profile file did not. Those two runs are the evidence, not the code reading.

So the extension merges into that workspace file, keeping the folder list and every setting already
in it: the theme keys from the window the user is looking at, the user's own
`extensions.supportAgentsWindow` entries, and one entry per extension that provides a theme the user
selected (`themeProvidingExtensionIds`, matching the setting against both the theme id and the label
the picker shows). A theme extension is opted in because it paints the theme, not because Caret
knows its name. The write happens at activation and on every change to those settings, so it does
not depend on which route opens the Agents window.

What this replaced: the earlier carry put the theme keys into Caret's *own* workspace file
(`caret-agents.code-workspace`, reached only from `openCaretAgentsWindow`, which the workbench
action does not call). That file is never written in the real flow, and the window reads the base's
file - so the keys that did reach the window came from somewhere else entirely.

## Verification

| check | result |
|---|---|
| `bun scripts/prepare-desktop.ts` | `26 patches, 18 removals` (green; was red) |
| full set applied in manifest order onto a clean worktree at `ea1912fd6a0` | 26 patches + 18 removals, no conflicts |
| that worktree vs the checkout, source paths | byte-identical (`src/vs/sessions/**`, `build/next/index.ts`); the only differences are the branding/build artefacts `scripts/build-caret.ts` writes (`extensions/caret/{media/caret.svg,package.json}`, `resources/darwin/code.icns`, extension `dist` output) |
| `bun run typecheck` | 0 errors |
| `node scripts/ci-validate.mjs` | `CI-OK parents=198 ui=75 children=129 lock-shas=10 doc-links=69 md=88` |
| `bun scripts/cursor-parity-check.ts` | `340 keys checked, 32 authored by Caret, 0 mismatches` |
| `bun test packages/omp-adapter packages/relay apps/host apps/macos/test` | 734 pass / 0 fail |
| `bun test apps/macos/test/workbench-mode.test.ts` | 20 pass / 0 fail (2 new: provider matching, workspace-settings merge) |
| packaged app, Agents window, read over CDP | `Catppuccin-catppuccin-vsc-themes-mocha-json`, `--vscode-editor-background: #1e1e2e` - the user's own dark choice, resolved through the user's own extension |
| packaged app, IDE window first, then Agents: the carrier | after the IDE window activates, `agent-sessions.code-workspace` holds the user's current theme keys and `extensions.supportAgentsWindow` with `catppuccin.catppuccin-vsc: true`; with those two keys removed by hand, the same launch falls back to `vscode-theme-defaults-themes-2026-light-json` |
| packaged app, Apps panel, read over CDP | rail `["Changes","Browser","Terminal","File"]`; the `+` menu lists the same four with readable text; two rail clicks on Browser leave 2 instance tabs |

## 3. Two defects the user reported, and what they actually were

**"I can't open more browser tabs from `+`."** The `+` menu was fine - it creates a new instance, and
a second and third after it. What could not open a second tab was the **rail**: the workbench bundle
inside the app was a build from 21:21, and the source moved at 21:49 from "the rail selects the pane
that is already there" to "every entry opens its own instance". The bundle was never rebuilt, so a
rail click re-used the open browser. `--package` only rebuilds the Caret extension; the workbench
under `Contents/Resources/app/out/` changes only when `node build/next/index.ts bundle --minify` is
followed by copying `desktop/out-vscode` over it, and the app has to be re-signed afterwards because
that write lands past the seal.

**"The Agents browser still has a user icon for Copilot login."** That was
`0029-caret-agents-no-account-widget.patch`: the sessions workbench registers an account/status
action into the title bar's right layout and draws it with its own view item, and Caret has no
account - the host is local and authenticated by its descriptor. The control could only draw a
Copilot-flavoured "signed out" avatar.

Both were read back on screen after the rebuild: the rail and `+` each add an instance and the new
one becomes the tab on screen (exactly one visible instance container), and the Agents window has
zero account widgets and no "signed out" label.

## Not verified

- The theme in the **light** slot, and a live theme switch from the IDE window while both windows are
  open; the runs above were cold starts.
- The rail is still a rail plus a tab row, not the reference's single-pane switcher, and
  `changes`/`file` still open editor-group tabs rather than living in the panel - the structural
  change §7.4 (1) describes.
- The context-menu surface in `0021` no longer has to carry the Agents window on its own: with a
  resolved theme the menu paints `rgb(24, 24, 37)` (Catppuccin Mocha's mantle) rather than the
  raised `#2d2d30` the rule paints for a stock theme. Both are readable; which one shows depends on
  the theme.
- A stale `workbench.preferredDarkColorTheme: "Catppuccin Latte"` (a light flavour in the dark slot)
  used to sit in `agent-sessions.code-workspace` and shadow the user's own settings. The carry now
  overwrites it on every IDE activation, which is why the window shows Mocha; nothing here changes
  what the user set in their own settings file.
