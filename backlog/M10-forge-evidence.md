# M10 forge evidence — Gitea sync-matrix kernel, live (2026-09-10)

Daemon (`caret-adapter` branch): `forge.ts` (GiteaClient, owned fetch
wire, no SDK) + stub harness + 3 keepers. Throwaway
`/tmp/caret-forge-live/proof.mjs` against real Gitea **1.27.3**
(official darwin-amd64 binary under Rosetta — no arm64 build ships;
source lock `92f2f61` in `UPSTREAM-LOCK.md` stays the reference).

## Live proof (PROOF-PASS, ~8s, localhost:13000, sqlite)

`repo.create` → push `main`+`feature` over HTTP token auth → `pr.open`
(#1, open, head sha) → `pr.read`+`list` → `pr.merge` (merged=true) →
refs agree both sides (`origin/main` == `ls-remote`, server merged=true).

## Boundary notes (earned, not guessed)

- Token scopes are per-area: repo creation needs `write:user`, not just
  `write:repository` (403 otherwise — keeper-pinned as 401/404 surfaces).
- First PR attempt 404'd right after push (branch-index timing); retry
  passed — clients must treat fresh-push PR creation as retryable.
- Merge is confirmed by re-GET (merged flag), never by the merge echo.
- Local `main` does NOT advance on merge — compare tracking refs.

## Proven

3/3 stub keepers + live matrix green. Full daemon suite 51/51 with these.
Out of scope (blocked-external): hosted origin, GitHub sync, CLI/ACP/SDK
contract suites, webhook-driven autopilot (guard ready in `webhook.ts`).
