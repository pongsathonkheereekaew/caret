# M5 TCP live evidence — real Codex turn over the gateway (2026-09-10)

Throwaway `/tmp/caret-tcp-live/proof.mjs` against `serve-tcp.ts`
(loopback, pairing token, scratch git repo). Wall 21.6s, first attempt
after the Scope fix (see below).

## Steps (all PASS)

1. `launcher-ready` — `remote.ready` line, ephemeral port, token via env
   (never printed; file path only when env-absent).
2. `session-start` — real Codex thread on the scratch repo.
3. `approval-surfaced` — exact command
   (`/bin/zsh -lc "printf 'hello tcp' > hello-tcp.txt && cat hello-tcp.txt"`)
   shown BEFORE execution over the socket event.
4. `approval-accepted` → `turn state=completed`.
5. `review` — 174-char diff names `hello-tcp.txt`.
6. `export` — `files=1 events=33` → `bundle.json` on disk, goal matches.
7. `session-stop ok`.

## Launcher bug the proof caught (fixed)

`serve-tcp.ts` first bridged requests through bare
`runtime.runPromise`: `startCaretRun` forks its approval stream with
`forkScoped`, which needs an ambient Scope — "Service not found:
effect/Scope". Fixed with one process-lifetime scope
(`Scope.make()` + curried `provideService(Scope.Scope)(scope)` per
request; the data-first `Layer.succeed(Scope, scope)` form does NOT
satisfy the lookup in smol — verified minimal). Session fibers now
outlive any single envelope, the `server.ts` posture. Also recorded:
smol has no `Effect.runtime`, its `provideService` is fully curried, and
fibers expose no `.join` method (`Fiber.join(f)` instead).

## Companion (same commit range)

`serve-tcp.ts` ships as the M5 entry (host/port/pairing envs, 0600
pairing file, token never on stdout). Throwaway proof stays in /tmp.
Steer-over-TCP live proof: see AG05 evidence (separate run).
