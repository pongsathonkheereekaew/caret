# Caret G0 Mac build spike — 2026-09-12

This evidence records a clean Mac baseline build of the retained Caret Code-OSS
checkout. It is a build/runtime probe only; no product source files were changed
and no provider session, login, or prompt was started.

## Provenance

- Checkout: `/Users/pond/caret/source/desktop`
- Worktree: detached Git worktree created with `git worktree add --detach`
- Baseline: `ea1912fd6a05b80a56b2ad9b955075211deea521`
- Baseline subject: `Agents: fetch and open cached documentation URLs`
- Product: Caret Code-OSS `1.138.0` (`product.json` nameShort/nameLong)
- Host: macOS `26.6.2` build `25G83`, `arm64`
- Node/npm: `v24.18.0` / `11.16.0` from `/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin`
- Build configuration: `.nvmrc` `24.18.0`; `.npmrc` Electron target `42.10.0`, ms build id `15109253`
- Native toolchain: `/Library/Developer/CommandLineTools`; full Xcode is not installed/selected

The `.log` files here are concise command/result summaries retained by the build
agent, not full raw stdout captures. Runtime startup was assessed from process
logs; the UI was not visually inspected.

## Commands and results

All Node/npm commands were run with the pinned Node directory first in `PATH`.

1. `npm ci --no-audit --no-fund` — **PASS**. Root dependencies installed (`1601 packages` including postinstall workspaces).
2. `npm run compile-client` — **PASS**. Client, source, built-in extension and media compilation completed in `3.08 min`; the terminal summary reports `0 errors` for all compiled lanes. See [compile-client.log](compile-client.log).
3. `npm ci --prefix extensions/caret --no-audit --no-fund` — **PASS**. Caret extension lockfile dependencies installed (`2 packages`).
4. `npm --prefix extensions/caret run compile` — **PASS**. Explicit `tsc -p ./` completed with no diagnostics. This separate step is required because the upstream gulp compile does not include `extensions/caret`.
5. `npm run electron -- arm64` — **PASS**. Electron runtime bootstrap produced `.build/electron/Caret.app`; the executable is Mach-O `arm64`, and `.build/electron/version` is `42.10.0`. See [electron-bootstrap.log](electron-bootstrap.log).
6. `.build/electron/Caret.app/Contents/MacOS/Caret --version` — **PASS**, output `v42.10.0`.
7. Development smoke launch — **PASS (boot only)**. The compiled app was launched for 15 seconds with isolated `/tmp` user-data and extensions directories, `NODE_ENV=development`, `VSCODE_DEV=1`, `--disable-gpu`, and `--no-sandbox`; it reached the workbench, started the agent host and extension host, then exited cleanly after the bounded probe. No Caret process or temporary directory remained. See [launch-smoke.log](launch-smoke.log).

## Interpretation and limits

The result proves that the pinned retained Mac baseline compiles, the explicit
Caret extension compiles, Electron 42.10.0 can be bootstrapped for arm64, and a
development workbench can start on this host. It does not prove OMP adapter
behavior, provider authentication, mobile continuity, signing/notarization, or
packaging for distribution.

The smoke log intentionally contains expected degraded-start diagnostics such as
`No default agent registered`, unsigned-in/no provider messages, and unknown
agent-host channels. These diagnostics do not establish provider capability or OMP integration; no
provider prompt or login was submitted during the probe.

The control-repository validator lives in `/Users/pond/caret/source/scripts/ci-validate.mjs`,
not in the detached Code-OSS baseline. Root ran it in the control checkout and
it passed (`parents=198 ui=75 children=129`). Its absence in `desktop/` is expected.

Signing, notarization, and distribution packaging were not attempted. Full Xcode
was not installed/selected; that observation alone does not establish that every
signing/notarization operation is blocked. Check the actual required tools and
signing identity at the release gate.
