# The `+` menu opened behind the page, and the false "corrupt installation" warning (2026-09-15)

Two defects the user hit in the packaged app, both invisible to the DOM-level checks the earlier
rounds used.

## 1. `+` could not open a second browser tab

**Symptom**: the first `+` → Browser worked; every later attempt did nothing.

**Why the first diagnosis was wrong**: an earlier round reported that the `+` menu creates new
instances, because a CDP probe clicked it three times and the tab count went 1 → 2 → 3. But CDP
injects events into the renderer, and a hosted page is a **native view drawn above the window's
DOM** (the same property behind the S4 visibility bug). Injected clicks bypass it, so the probe
could not see the failure a real mouse hits: once a browser tab exists, the menu that `+` opens is
painted *behind* the page, and the user's click on "Browser" lands on the page.

**Fix** (folded into `0021`, which creates the file): `openNewTabMenu` takes the hosted page out of
the way before showing the menu (`hideBrowserForPopup`) and `applyActiveTab` puts it back on
`onHide` (`restoreAfterPopup`). The page keeps its measured bounds, so restoring is the same call
the pane already makes when the active tab changes.

**Verified with a real mouse** (Computer Use, not CDP): `+` → Browser twice in a row against the
packaged app, with a browser tab already open. The window's accessibility tree went from four
browser tabs to five, the new one `(selected)`. The menu is also reachable in the tree while open
(`menu` with Changes/Browser/Terminal/File).

This is the general lesson for this surface: **anything the pane draws in the DOM over its own
bounds has to be checked with real input**, because the renderer-level probes cannot see the native
page. The address bar's suggestion list already deals with the same overlay by shrinking the page's
bounds; the menu hides it instead.

## 2. "Your Caret installation appears to be corrupt. Please reinstall."

**Not** caused by the bundle copy. All ten entries in the packaged `product.json`'s `checksums`
were wrong, including files no round of this work had touched (`preload.js`,
`extensionHostProcess.js`, `workbench.html`): the pinned packager writes the checksums of the build
it packaged, and this app is assembled by copying `desktop/out-vscode` over the packaged `out/`.
A normal VS Code build regenerates them as its last step; nothing in Caret's packaging did.

**Fix**: `scripts/build-caret.ts --package` now recomputes them from the files actually in the
bundle, before signing (the file is inside what gets sealed). The encoding matters:
`ChecksumService.checksum` resolves `hash.digest('base64').replace(/=+$/, '')`, so the padding has
to be stripped - with the padding left on, every file still compared as modified.

**Verified**: `checked 10 mismatched 0`, and a fresh launch's accessibility tree contains no
corruption notification (it did before).
