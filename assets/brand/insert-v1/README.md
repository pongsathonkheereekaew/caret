# Caret Insert — v1

Refines the user's selected concept 02 into editable SVG. Approved as Caret's
primary macOS/iOS identity on September 13, 2026.

- `mark.svg`: transparent monochrome mark, `currentColor`, 256-unit grid.
- `app-light.svg` / `app-dark.svg`: opaque 1024px square masters, without a
  baked-in platform corner mask. Strictly monochrome: the light master is a
  `#FFFFFF` body with a `#000000` mark, and the dark master inverts both. No
  accent hue is used anywhere in the app icon.
- Matching PNG files: opaque RGB 1024px raster exports used by Expo's root icon
  and iOS light/dark icon configuration in `apps/ios/app.json`.
- `app-macos.svg` / `app-macos.png`: padded, rounded macOS artwork.
- `caret.iconset` / `caret.icns`: standard 16–1024px macOS icon representations.
  `bun run build:mac` copies the ICNS into `desktop/resources/darwin/code.icns`,
  the retained Electron and DMG packaging input, and `dist/brand/caret.icns`.
  To regenerate, screenshot `app-macos.svg` with headless Chrome at
  `--window-size=1024,1024 --force-device-scale-factor=1
  --default-background-color=00000000`. For the smaller iconset reps, centre the
  image at its target size inside that same 1024px page and then
  `sips -c <size> <size>`: Chrome clamps windows below roughly 500px, so
  shrinking `--window-size` crops a blank corner instead of rasterising a
  smaller icon. Do not use `qlmanage`, which flattens the transparent corners
  onto white. Finish with `iconutil -c icns caret.iconset -o caret.icns` from
  this directory.
- `preview.svg` / `preview.png`: presentation with illustrative rounded masks
  and 16/24/32/48/64px samples. View at 100% for pixel-size assessment.

The symbol uses 24-unit rounded strokes with a 36-unit clear gap between the
chevron tip and cursor. Light and dark versions share identical geometry and are
monochrome white `#FFFFFF` and black `#000000` only, as requested on
September 14, 2026.
No external font, icon library, image-generation call or new dependency is
required to render the mark. The preview uses a system font for labels only.

The extension activity bar and task header use the monochrome Insert mark.
`bun scripts/build-caret.ts --desktop` and `--package` re-apply the ICNS to the
dev Electron bundle (`desktop/.build/electron/Caret.app`, what
`desktop/scripts/code.sh` launches) and to the packaged app, and refresh the
bundle timestamp plus its LaunchServices record, because Finder and the Dock
cache the icon per bundle path. Already running apps still need a relaunch for
their OS icon to change. Real Dock and iPhone home-screen verification remain
release checks; asset/configuration verification does not claim device
verification.
