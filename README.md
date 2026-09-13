# Caret

The AI-native code editor you own. Agents, predictive editing, and code review in one fast, local-first IDE. Your code never leaves your machine.

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
2. Read [HANDOFF.md](HANDOFF.md) for the latest status.
3. Read [docs/TEAM-ONBOARDING.md](docs/TEAM-ONBOARDING.md) before making changes.

## Built on VS Code

Caret is built on VS Code, so the editor, keybindings, and extensions you already know keep working, with an AI-native layer on top.

## Repository layout

- [AGENTS.md](AGENTS.md) - living agent instructions
- [HANDOFF.md](HANDOFF.md) - dated control-repo status
- [agent.md](agent.md) - historical pointer
- [docs/](docs) - plans and contributor onboarding
- [backlog/](backlog) - per-item evidence.
- [scripts/](scripts) - repo checks.

## Development

Run the repo gate before pushing:

```bash
node scripts/ci-validate.mjs
```

See [HANDOFF.md](HANDOFF.md) for the full workflow.

## Documentation

- Status and roadmap: [HANDOFF.md](HANDOFF.md)
- Contributor onboarding: [docs/TEAM-ONBOARDING.md](docs/TEAM-ONBOARDING.md)
- Master plan: [docs/IMPLEMENTATION-PLAN.th.md](docs/IMPLEMENTATION-PLAN.th.md)

## Security

This is a private repository. Please do not report security vulnerabilities through public issues. Contact the owner directly.
