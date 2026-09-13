# Caret — Release identity placeholders (H02)

Fork commit `7579c4a` on `~/caret-work/caret-desktop` (`caret` branch).
Provisional values (must be replaced before any distribution):

| Item | Current | Must become (gate) |
|---|---|---|
| Remote repo / issue URL | `github.com/caret/caret` (does not exist yet) | real repo URL before first shared build (M1) |
| License URLs | same provisional repo | `LICENSE.txt` + `NOTICE` in fork root at release (M7) |
| `darwinBundleIdentifier` | `com.caret.editor` | keep, unless user supplies org domain |
| Update channel (`quality`, `updateUrl`) | UNSET — no update server | own channel + signed updates before M7 exit; until then manual installs only |
| Signing (macOS notarization, Win cert, GPG) | none | user-provided identities at M7; never commit secrets |
| Extension gallery | Open VSX block (verified from VSCodium `prepare_vscode.sh`) | keep; per-extension license matrix at M1 (G-EXT-01) |
| Copilot default agent + MS voice endpoint | voice URL dropped; `defaultChatAgent` KEPT (raw derefs in chat UI) | M1: code guards + Caret default agent; extension curation with license matrix |

Kept-aside (M1, not H02): `extensions/` tree untouched, webview CDN
template untouched (VSCodium precedent), `package.json` root name unchanged.
