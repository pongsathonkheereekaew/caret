# Caret

The AI-native code editor you own. OMP runs on your Mac; Caret provides the
workspace and a planned iPhone client.

> This repository is private. Caret is in active personal development for macOS and is not publicly distributed yet.

## Features

- **Agent composer** - describe the change, review the diff, accept or steer mid-run.
- **Predictive Tab** - fast single-line completions that never overwrite your edits.
- **Inline edit** - select code, describe the change, apply it as one undo step.
- **Review and worktrees** - every agent run is isolated. Bring changes back only when they are clean.
- **Headless CLI** - drive sessions, approvals, and reviews from the terminal with JSON output.

## Getting Started

Development builds run on macOS. There is no public download yet.

1. Clone this repository.
2. Read [AGENTS.md](AGENTS.md) for living agent rules.
3. Read [docs/README.md](docs/README.md) for the document map.

## Built on VS Code

Caret is built on VS Code, so the editor, keybindings, and extensions you already know keep working, with an AI-native layer on top.

## Repository layout

- [AGENTS.md](AGENTS.md) - living agent instructions
- [HANDOFF.md](HANDOFF.md) - pointer to current vs archived status
- [docs/README.md](docs/README.md) - document map
- [backlog/](backlog) - requirement graph and per-item evidence
- [scripts/](scripts) - repo checks

## Development

Run the repo gate before pushing:

```bash
node scripts/ci-validate.mjs
```

## Documentation

- Living rules: [AGENTS.md](AGENTS.md)
- Document map: [docs/README.md](docs/README.md)
- Dated snapshots: [docs/archive/](docs/archive/README.md)

## Security

This is a private repository. Please do not report security vulnerabilities through public issues. Contact the owner directly.
