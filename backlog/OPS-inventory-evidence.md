# OPS license + patch inventory evidence (H16 seed, 2026-09-10)

## License inventory (files read, not metadata)

| Component | Revision | License file | Result |
|---|---|---|---|
| Code-OSS (`~/caret-work/desktop`) | `3e078a3` | `LICENSE.txt` | MIT (Microsoft) |
| Synara (`~/caret-work/upstream-synara`) | `59db80a` | `LICENSE` | MIT, T3 Tools Inc. + Emanuele Di Pietro notices present (2 matches) |
| Paseo | `433e67b` (no checkout — fallback only) | per UPSTREAM-LOCK | Apache-2.0 per file (metadata NOASSERTION — unchecked, no code taken) |
| Codex / OpenCode engines | drivers only, no vendored code | — | no license surface in Caret (engines own auth) |
| Gitea test binary | 1.27.3 official (Rosetta) | not distributed | no surface (test-only, /tmp instance) |
| nomic-embed model | Q4_K_M (Apache-2.0) | test-only | no surface (probe-only) |

No vendored third-party code in the daemon (owned wire, no SDKs);
the fork adds `extensions/caret` (Caret MIT) + product-identity files.

## Fork patch inventory (`caret` branch, 14 commits over upstream)

Tab provider + settings + stale guards · inline edit/handoff/search ·
trust-gated manifest + composer/approval webview · Bring Back · scoped
`cmd+k` · Runs picker · Steer/Export flow · fence-strip · `CARET.md`.
Full list: `git log --oneline -14` on `caret` (all `Caret*`/`Tab:`/`M7 docs:`).

## Daemon inventory (`caret-adapter`, 12 commits over `59db80a`)

Session facade, worktrees, MCP stdio+HTTP, picker, hooks, session-API
factory, TCP gateway + launcher, export, steer RPC, lease/handoff,
webhook, forge, audit. Full list: `git log --oneline 59db80a..caret-adapter`.

## Requirement graph backfill (this round)

38 parents touched, 82 child cases from evidence:
verified 14 / implemented 24 / planned 160 (was 198 planned).
Rule: verified = every child passes on an OBSERVED run (suites count —
they run real git/HTTP/TCP; behavior-at-its-layer counts, UI rendering
needs UI observation); shipped-but-unobserved = implemented; failed
attempts stay planned with fail-result children (TAB-03).

## CI first run (2026-09-10) — blocked by account billing, not by repo

Workflow `.github/workflows/ci.yml` (graph+lock validation × 3 OS)
pushed and triggered, but every job died in ~4s with zero steps:
`The job was not started because recent account payments have failed or
your spending limit needs to be increased` (Billing & plans settings).
Validator itself is green locally (`CI-OK parents=198 ui=75
children=92`). Fix is on the account (phone-doable), then re-run.
Vendor-out of daemon/extension sources deferred with reason: the
upstream import fan-out (opencode SDK, agentGateway, skills…) makes
vendoring a license/patch project of its own — tracked, not started.

## CI green via self-hosted runner (2026-09-10)

Billing flag blocks github-hosted jobs, so the always-on Mac runs them:
`caret-mac` (actions-runner v2.337.0, `~/.caret-tools/actions-runner`,
labels macos/arm64/caret) under LaunchAgent `com.caret.gha-runner`
(reboot-persistent, no sudo). Workflow retargeted to
`[self-hosted, macOS, ARM64]`; ubuntu/windows matrix returns when
billing is fixed. First run: **success in 29s**. Risk note: self-hosted
runners execute repo code — acceptable with zero outside contributors;
revisit before accepting external PRs.
