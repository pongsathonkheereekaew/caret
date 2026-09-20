# M4-hooks evidence — explicit post-create setup hooks (2026-09-10)

Daemon (`caret-adapter` branch): `SetupHook` + `runSetupHooks` in
`apps/caret-daemon/src/worktree.ts`, wired into `startCaretRun`
(`runOptions.setup`, journaled as `caret.run.setup`) in `daemon.ts`.

## Design (trust-led)

- NO auto-discovery: hooks arrive only via the call param, never from repo
  scripts — an untrusted checkout must not auto-execute. No `server.ts`
  RPC exposure in V1 (setup runs pre-session without an approval turn, so
  the webview must not be able to inject commands). Daemon-owned defaults
  (e.g. per-OS toolchain checks) are the future consumer, e.g. M5 remote.
- NO shell: command + args go to `execFile` directly (a spaced binary name
  fails `ENOENT` — keeper-proven, no splitting).
- OS-specific: `os?: [...]` filter against `process.platform`; skipped
  hooks report `{skipped:true}` instead of silently vanishing.
- Sequential (later hooks may depend on earlier ones); failure fails run
  creation with command + stdout/stderr tail (same 600-char trim as `fail`).

## Proven

- 2 new keepers in `worktree.test.ts`: order + platform skip + empty
  no-op; loud failure (exit-3 stderr), timeout kill (`timed out`, real-timer
  exception noted — the kill lives in the child timeout, not the JS clock),
  no-shell ENOENT. Full daemon suite 24/24.
- M4 tail after this: MCP full-OAuth flow (blocked-external, seam ready),
  live UI verification (human track).
