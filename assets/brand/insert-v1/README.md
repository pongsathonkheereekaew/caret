# Caret Insert — v1

Refines the user's selected concept 02 into editable SVG. Approved as Caret's
primary macOS/iOS identity on September 13, 2026.

- `mark.svg`: transparent monochrome mark, `currentColor`, 256-unit grid.
- `app-light.svg` / `app-dark.svg`: opaque 1024px square masters, without a
  baked-in platform corner mask. Ivory `#F5F2EB`, graphite `#292A2C`, dark
  background `#25272B`.
- Matching PNG files: opaque RGB 1024px raster exports used by Expo's root icon
  and iOS light/dark icon configuration in `apps/ios/app.json`.
- `app-macos.svg` / `app-macos.png`: padded, rounded macOS artwork.
- `caret.iconset` / `caret.icns`: standard 16–1024px macOS icon representations.
  `bun run build:mac` copies the ICNS into `desktop/resources/darwin/code.icns`,
  the retained Electron and DMG packaging input, and `dist/brand/caret.icns`.
  Regenerate ICNS on macOS with `iconutil -c icns caret.iconset -o caret.icns`
  from this directory after regenerating the PNG sizes from `app-macos.svg`.
- `preview.svg` / `preview.png`: presentation with illustrative rounded masks
  and 16/24/32/48/64px samples. View at 100% for pixel-size assessment.

The symbol uses 24-unit rounded strokes with a 36-unit clear gap between the
chevron tip and cursor. Light and dark versions share identical geometry.
No external font, icon library, image-generation call or new dependency is
required to render the mark. The preview uses a system font for labels only.

The extension activity bar and task header use the monochrome Insert mark.
Already packaged/installed apps need rebuilding and reinstalling for their OS
icon to change. Real Dock and iPhone home-screen verification remain release
checks; asset/configuration verification does not claim device verification.
