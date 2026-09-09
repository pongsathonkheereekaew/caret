# F01 evidence — Code-OSS build & launch (2026-09-10)

Pinned: `microsoft/vscode @ 3e078a3` · Toolchain: node 24.18.0 (repo `.nvmrc`
requires 24.18.0) · Host: macOS arm64 (M3).

## PASS (macOS arm64)

1. **Deps**: `npm install --no-audit --no-fund` — clean, 1601 packages.
   First attempt inside the space-containing repo path failed on
   `@vscode/fs-copyfile` node-gyp (unquoted path); moved checkouts to
   space-free `~/caret-work` — installs clean there. (Upstream build scripts
   do not tolerate spaces; the editor RUNTIME still must — IDE-01.)
2. **Compile**: `npm run compile` (compile-client + compile-copilot) —
   clean, `Finished 'compile' after 2.75 min`, no errors.
3. **Launch**: `./scripts/code.sh` (preLaunch fetched Electron bundle into
   `.build/electron/Code - OSS.app`, then booted the full workbench). The
   process stayed alive serving the window for the 30-min foreground window
   (killed by timeout, `error: interrupted`) — log stream proves a live
   workbench, not a crash:
   - `[AgentHost] No signed-in session resolved for resource:
     https://api.github.com/repos`
   - `[AccountPolicyGate] apply: state=inactive … isRestricted=false`
   - `Unknown channel: agentHostClientByokLm / agentHostClientProxy`
4. **Cleanup**: smoke processes reaped; isolated profile expected for future
   runs (`--user-data-dir /tmp/…`, never touch the user's live profile).

## Notable observation for H02

Upstream at this SHA ships `agentHost` infrastructure with BYOK/proxy
channels. Track what it is before forking editor code around it — it may
overlap or constrain where Caret's Agents UI and editor bridge attach.

## OPEN (platform matrix, tracked — not passed)

- Windows x64/arm64 + Linux x64/arm64: no runners here; require CI
  (H02) with clean install → compile → launch per family before M1 exit.
- Windowed launch was observed via logs, not screenshotted; interactive
  smoke (open folder → edit → terminal → Git) belongs to H02 fixtures.
