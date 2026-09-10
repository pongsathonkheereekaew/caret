# H02 evidence — branded fork builds and boots (2026-09-10)

Fork: `~/caret-work/caret-desktop`, branch `caret`, `7579c4a` on pinned `3e078a3`.

## PASS (macOS arm64)

1. **Install**: `npm install --no-audit --no-fund` — clean, 1601 packages.
2. **Compile**: `npm run compile` — clean, 1.57 min.
3. **Boot**: `./scripts/code.sh --user-data-dir /tmp/caret-smoke-profile
   --version` fetched the Electron bundle as **`Caret.app`** and booted a
   full workbench: `Caret` + `Caret Helper` (gpu/network/renderer) processes,
   isolated profile written, AgentHost + workbench log stream flowing
   (`vscode-file://vscode-app/…/caret-desktop/out/…`). Identity patch holds
   end to end — binary, helpers, and profile are Caret-named.
4. **Cleanup**: smoke processes reaped; profile dir removed after shutdown.

## Process-hygiene note (self-inflicted, no product impact)

The boot log tail shows `SQLITE_READONLY_DBMOVED` on `state.vscdb` — caused
by deleting the smoke profile directory while the app was still shutting
down, not by the build. Rule: remove temp profiles only after the process
tree is confirmed dead.
