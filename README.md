# Caret

The AI-native code editor you own. OMP runs on your Mac; Caret provides the
workspace and a planned iPhone client. External model providers and optional
remote transport handle data according to the configuration you choose.

Current work: the plan is a single authoritative document again -
[CARET-PLAN-2026-09-14.th.md](docs/maintenance/CARET-PLAN-2026-09-14.th.md) holds the product
definition, the Cursor parity contract, the SSOT rules and steps S1-S5. The feature list below
describes the product target, not a release certification.

> This repository is private. Caret is in active personal development for macOS and is not publicly distributed yet.

## Features

- **Agent composer** - describe the change, review the diff, accept or steer mid-run.
- **Inline edit** - select code, describe the change, apply it as one undo step.
- **Review and worktrees** - every agent run is isolated. Bring changes back only when they are clean.
- **Headless CLI** - drive sessions, approvals, and reviews from the terminal with JSON output.

## Getting Started

Development builds run on macOS. There is no public download yet.

1. Clone this repository.
2. Read [docs/README.md](docs/README.md) for the living specification map.
3. Read [HANDOFF.md](HANDOFF.md) for the current status pointer.

## Built on VS Code

Caret is built on VS Code, so the editor, keybindings, and extensions you already know keep working, with an AI-native layer on top.

## Repository layout

One git repo. Folders are module boundaries, not separate remotes.

- `apps/host` - Mac host service
- `apps/macos` - Code-OSS task extension
- `apps/ios` - iPhone client
- `packages/protocol`, `packages/omp-adapter`, `packages/relay` - shared libraries
- `desktop/` and `upstream/` - ignored pinned checkouts, not source of truth
- [docs/README.md](docs/README.md) - living specification map
- [HANDOFF.md](HANDOFF.md) - pointer to current status
- [backlog/](backlog) - per-item evidence
- [scripts/](scripts) - repo checks

## Development

The new adapter uses Node-compatible TypeScript and Bun for development tests:

```bash
bun install --frozen-lockfile
bun run typecheck
bun test packages/omp-adapter apps/host packages/relay apps/macos/test
bun run smoke:omp
bun run smoke:omp:ui
bun run smoke:omp:g1
```

The first two smoke commands use isolated temporary configurations and local
extension commands without model turns. The G1 host smoke exercises actual OMP
tool turns with deterministic completions from a temporary loopback server;
it performs no external model inference. All accept the pinned baseline OMP 18.1.18 and any
later patch of the same 18.1 line (`OMP_BASELINE_VERSION` and `isSupportedOmpVersion` in
`packages/omp-adapter/src/types.ts`); a different minor line moves the baseline.
The Mac build uses the separately pinned
Code-OSS checkout; see the G0 evidence for its exact status.

Run the repo gate before pushing:

```bash
node scripts/ci-validate.mjs
```

See [docs/README.md](docs/README.md) for the living specification map.

## Documentation

- Specification map: [docs/README.md](docs/README.md)
- Current status: [HANDOFF.md](HANDOFF.md)
- Dated snapshots: [docs/archive/](docs/archive/README.md)

## Security

This is a private repository. Please do not report security vulnerabilities through public issues. Contact the owner directly.
