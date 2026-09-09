# ADR-001: Backend owner — adapted Synara services (preferred), Paseo/direct fallback

Date: 2026-09-10 · Status: **interim** (static boundary passes; runtime
conformance SYN-03 + H04 control-path test still required before lock-in).
Decides G-OSS-01 / F02.

## Context

Caret needs exactly one orchestration owner (L8.6): session/worktree/history,
event journal, permission/approval flow. Candidates: adapted Synara
services/contracts (`59db80a`), Paseo (`433e67b`, fallback), direct
Codex/OpenCode adapters + minimal coordinator (second fallback).

## Static evidence (inspected 2026-09-10, no build/run)

1. **UI/backend separable: YES.** `apps/server` imports only
   `@synara/contracts` + `@synara/shared` workspace packages; zero `apps/web`
   source imports (only test-fixture strings, dev-mode hints, and serving the
   prebuilt web bundle as static assets). Server is a CLI (`@synara/cli`,
   `synara` bin, `dist/index.mjs`) — no Electron main inside the server path.
2. **Contract matches L8 thin spec.** `packages/contracts/src/provider.ts`:
   startSession/sendTurn(steer)/interruptTurn/stopSession/compactThread/
   forkThread/respondToRequest/respondToUserInput/startReview/steerSubagent/
   backgroundTask; events kinds `session|notification|request|error` with
   engine-native IDs. Delta vs J5 to add in OUR envelope (not upstream):
   idempotency keys, expectedRevision, per-stream sequence numbers.
3. **Approval is engine-native pre-execution on both drivers.**
   - Codex: `item/*/requestApproval` → `request` event → `respondToRequest`
     → engine answers before acting; auto-review deny/abort handled.
   - OpenCode: `permission.asked` → policy auto-reply or human `request`
     event → `permission.reply`, with explicit fail-closed design (interrupted
     Plan turns can never resume as Full Access; resume forces plan-mode
     rules; pending-permission reconciliation on reconnect).
   This is the interception point H04 requires — no facade-after-side-effect.
4. **Dependency footprint (price of reuse).** Effect framework throughout,
   `bun` runtime for dev/test (`packageManager: bun@1.4.2`, `@effect/sql-sqlite-bun`),
   engines `node ^22.19 || ^23.11 || >=24.10` (our pinned 24.18.0 qualifies).
   Provider SDKs vendored as deps (`@opencode-ai/sdk`, `pi-agent-core`,
   `claude-agent-sdk`, ACP sdk, `node-pty`). Not drop-in short adapters —
   adopt as a stack (L5 SYN-03) or not at all.

## Decision

Adopt **adapted Synara services/contracts as the preferred single owner**;
keep Paseo pinned as fallback; direct adapters as second fallback. NO second
owner alongside Synara in any configuration.

## Runtime gates before lock-in (SYN-03 / H04)

- [ ] `bun install --frozen-lockfile` clean + upstream contract/adapter test
      suites pass on this machine (SYN-06 re-run).
- [ ] Command→engine→event→projection trace on a REAL Codex run (ChatGPT
      login present, F03): approval request surfaces BEFORE any side effect;
      deny aborts without mutation (fixture: create-file in scratch repo).
- [ ] Same trace on OpenCode driver (needs OpenCode CLI + Go/OpenRouter auth —
      user gate, see F03).
- [ ] Dirty-buffer reconcile path identified in adopted code (feeds F04/SYN-04).

## Consequences

- Toolchain additions: bun 1.4.2 (`~/.bun`), node 24.18.0
  (`~/.caret-tools`) — recorded in `docs/UPSTREAM-LOCK.md`.
- If any runtime gate fails unfixably at the facade level (engine
  ownership/auth internals would need patching), drop Synara backend and fall
  back WITHOUT building proxy layers around it (J8).
