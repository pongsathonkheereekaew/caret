# Caret iPhone client

The phone controls sessions owned by the Mac host through an encrypted Paseo relay. Pair using the private QR code from **Caret: Pair iPhone** on the Mac. Credentials live in Expo SecureStore; cached task state contains no pairing credential.

## Development

```sh
npm ci --ignore-scripts
npm run prepare:security
npx expo install --check
bun run test
bun run typecheck
npm run export:web
```

`ios/` is the generated, reviewable Expo SDK 54 native project. Regenerate configuration with `npx expo prebuild --platform ios --no-install`. Native compilation requires Xcode, its iOS SDK and CocoaPods; then use `npm run ios`. Device signing must use the owner's development team. No cloud build subscription is required by this project.

The checked-in project has been generated successfully; it has **not** been compiled or tested on an iPhone. Web export is not evidence of native WebView, SecureStore, camera, sharing, cellular or background behavior.

## Dependency choices

Expo 54.0.37 and native module versions pass `expo install --check`. PostCSS is pinned through an override to 8.5.28. Xcode's UUID dependency uses 11.1.1, which retains CommonJS and the `v4()` call used by xcode; native prebuild and web export passed with these overrides. See the [PostCSS releases](https://github.com/postcss/postcss/releases) and [UUID security backport](https://github.com/uuidjs/uuid/releases/tag/v11.1.1).

The dependency audit still reports `image-size` vulnerabilities through Metro's build toolchain. A local, source-hash-checked bounds backport prevents zero-length ICNS entries and undersized/zero-length container boxes from looping. It runs after a normal install and before the supported build commands; after `--ignore-scripts`, run `npm run prepare:security` explicitly. Malformed-container subprocess tests and the real app PNG test pass. The advisory version still appears in npm audit: this is a local mitigation, not an upstream fixed release or a clean audit. Keep the dependency upgrade review open; do not run `npm audit fix --force`.

## Current bounds

- Artifact receipts are task/hash bound. Transfer verifies every range and the final SHA-256 before preview or sharing. The phone's current transfer ceiling is 32 MiB; text preview is 2 MiB. HTML and SVG display as text.
- The terminal uses bundled xterm, with no runtime CDN. Replay suppresses terminal-generated response input. If bounded history expires, the UI explicitly marks it expired; a complete authoritative terminal checkpoint is still pending.
- Unknown command outcomes are reconciled, never automatically replayed.
