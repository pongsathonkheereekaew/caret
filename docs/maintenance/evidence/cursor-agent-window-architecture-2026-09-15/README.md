# How the reference's Agents window is built (2026-09-15)

Question this answers: is the reference's agent surface a webview/HTML shell
(the shape Caret's retired `apps/macos/src/webview.ts` had), or something else?
It decides whether Caret's S1c choice - the base sessions workbench window
patched under `desktop/src/vs/sessions/**` - is the same architecture as the
reference or an approximation of it.

## Sources

1. Cursor docs, <https://cursor.com/docs/agent/agents-window> (fetched
   2026-09-15). "The Agents Window is Cursor's agent-first interface... You can
   switch back to the editor anytime, or have both open simultaneously." It names
   two entry points, `Open Agents Window` and `Open IDE`, and calls the second
   one "the classic Cursor IDE". Facts about the product, not the plumbing.
2. The installed app itself: Cursor **3.20.21**
   (`/Applications/Cursor.app/Contents/Resources/app/product.json`, commit
   `f09fca384c`). The plan's measurements were taken on 3.20.17; the entry-point
   evidence below is from 3.20.21.

## Findings

### The agent surface is a second workbench window, not an extension webview

`out/main.js` opens it through the window service with a dedicated flag and
launch intent:

```js
windowsMainService.open({ context: 5, cli: { ...r, glass: !0, "new-window": !0 },
  forceNewWindow: !0, forceEmpty: !0, allowAdditionalGlassWindow: t?.forceNewWindow === !0,
  glassLaunchIntent: t?.glassLaunchIntent })
```

and the same file switches back to the editor by looking for the window that is
*not* glass - `getWindows().find(i => i.config?.glass !== !0)` in
`cursorFocusOrOpenEditorWindow`. So "glass" is a first-class window kind in the
main process, with its own state: `glassLaunchIntent`, `glassWindowCount`,
`glassWindows`, `glassVibrancy`, `glassSplash`, `glassStoredSettingsId`,
`glassDetectColorScheme`, `glassMenubarFallback`.

### The glass window runs its own full web workbench bundle

| bundle | size |
|---|---|
| `out/vs/workbench/workbench.desktop.main.js` (IDE window) | 36.5 MB |
| `out/vs/workbench/workbench.glass.main.js` (Agents window) | 43.1 MB |

Both are Chromium renderer entries served by the same app; there is no separate
agent HTML page (`find out -name "*.html"` returns nothing outside the
`electron-sandbox/workbench/workbench.html` shell that both windows load).

The vocabulary the plan measured from the reference's live window - `Hide Apps`,
`Open new tab menu`, `Enter Full Screen` - occurs **only** in the glass bundle
(2 / 1 / 2 hits) and 0 times in the IDE bundle. The strings the plan reads as the
Agents window's own UI are therefore the glass workbench's, not an extension's.

### The same surface also appears inside the IDE window

The storage key `cursor/glass.rightPane` occurs in both bundles (glass: 2,
desktop: 1), which matches the plan's §3 reading of the reference's right-hand
Apps panel. So the reference does not choose between "own window" and "pane in
the IDE": it is one surface that can own a whole glass window or sit in the
IDE's right pane.

## What this means for Caret

- The S1c decision is architecturally the same as the reference: an agent surface
  built from the workbench, in its own window, patched under
  `desktop/src/vs/sessions/**`. The retired `webview.ts` shell was never the
  reference's shape for the Agents window, so nothing about S3 should resurrect
  it.
- Caret's still-live `caretComposerDock` (the IDE-mode dock, see the §6.2 row in
  the plan) is not wrong in *kind* - the reference does put this surface in the
  IDE's right pane - but it is wrong in *implementation*: Caret draws its own
  HTML for it instead of using the workbench's own pane. That is why the shell
  cannot be deleted yet, and why the replacement is workbench work rather than
  shell work.
- Inference, not measured: because the reference's agent surface is one surface
  in two hosts, a Caret implementation that keeps a separate HTML dock next to a
  workbench-hosted window will keep drifting from the reference in the panel
  area (the S4 rows that are still open). This is an argument for closing S4 on
  the workbench side; it is not itself evidence about Cursor's code.

## Uncertainty

- The 43.1 MB glass bundle was read by string presence, not decompiled; the two
  bundles share most of their code, so "present only in glass" is a statement
  about where a string is emitted, not about module ownership.
- Whether the reference's Apps panel hosts its Browser tab in a `<webview>` or in
  a native browser view was **not** determined here. The bundles contain the
  stock webview service (557 / 819 occurrences of `webview`), which is expected
  of any fork and is not evidence either way. Measure it on the live window
  before relying on it.
- The plan's geometry numbers (sidebar 255px, rig 1710x1073) were measured on
  3.20.17 and are not re-measured here.
