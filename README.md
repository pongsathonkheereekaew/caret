# Caret

A local-first IDE that runs agents on your own machine: Code-OSS fork (Caret UI) + Synara daemon (Codex/OpenCode engines). Private repo, Mac-only, no cloud. Latest status: `HANDOFF.md`

The goal is the clone-verified gate in the [v5 master plan](docs/IMPLEMENTATION-PLAN.th.md) (authoritative, Thai): 198 parent requirements, 75 UI families — the [scrutinize review](docs/SCRUTINIZE-REVIEW.th.md) and [reuse assessment](docs/SYNARA-ASSESSMENT.th.md) remain gates before building.

## Status (2026-09-10 evening)

- Requirement graph: **17/198 parents verified**, 115 child cases (`planned | implemented | verified | blocked-external` — `blocked-external` never counts as passing)
- Daemon suite **114/114** (`caret-adapter`): MCP tools/resources/prompts/elicitation, single-line FIM Tab, worktrees + bring-back, run picker/retention, TCP gateway + live proofs, ACP streaming, CLI `--json` + `send --ask`, local git commit/sync
- Fork (`caret` + `caret-native`): composer Steer/Export/Runs, `cmd+k` inline edit, native Agents shell at contract stage (rendering waits on the reference atlas)
- Still open: H05 click-through, reference atlas (Cursor 3.19), signing, devices/APNs, OAuth/cloud providers, independent benchmarks, hosted origin — all wait on a human, real hardware, or an external decision (details in `HANDOFF.md`)

## Locked decisions (do not reopen without new evidence)

- Local-only: code never leaves the machine (M8 CLOUD blocked-external except CLOUD-08)
- Mac-only: no Windows/Linux; CI on the self-hosted Mac runner
- Approval-gated writes; bring-back refuses on conflict, never forces
- Daemon is the SSOT for status/events/transitions; the fork only renders
- Engine budget: OpenCode Go subscription; no relay (loopback + LAN-direct); repo stays private

## Layout (read `docs/TEAM-ONBOARDING.md` before touching code)

| Checkout | Branch | Contents |
|---|---|---|
| `~/caret-work/caret-desktop` | `caret` (+ `caret-native`) | composer UI + native workbench contrib |
| `~/caret-work/upstream-synara/apps/caret-daemon` | `caret-adapter` | the whole daemon |
| control repo (here) | `main` | docs, `backlog/` evidence, requirement graph, CI |

Toolchain: `~/.caret-tools/node-v24.18.0-darwin-arm64`, `~/.bun`, `~/.opencode`, `~/.local/bin/codex`

## Key commands

- `node scripts/ci-validate.mjs` — control-repo gate
- `bun x vitest run apps/caret-daemon/src/` (from `upstream-synara`) — daemon suite
- `node_modules/.bin/tsc -p src/tsconfig.json --noEmit` (from `caret-desktop`) — fork typecheck
