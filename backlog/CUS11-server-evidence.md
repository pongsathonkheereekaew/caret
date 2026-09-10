# CUS-11 tool-server evidence — MCP tools we serve (2026-09-10)

Daemon: `mcp-server.ts` (`web_fetch`, `test_run` over MCP stdio) +
round-trip keepers in `mcp-server.test.ts` driving it with OUR OWN
`McpClient` — interop proven in both directions, no SDK either side.

## Tools

- `web_fetch{url, maxBytes?, timeoutMs?}`: http(s) only, credentials-in-
  URL refused, localhost/loopback/RFC-1918/link-local/cloud-metadata
  refused, 64KB default cap (1MB max), 15s default timeout, over-cap
  aborts mid-stream.
- `test_run{command, args?, cwd?, timeoutMs?}`: execFile (no shell),
  exit code + stdout/stderr tails in one text block, `isError` on
  non-zero exit or timeout kill.

## Proven

- 3/3 keepers (list shape, exec success/fail/timeout, 5 fetch refusals
  + unknown tool — all offline, no network in suite). Live fetch stays
  a manual probe by design.
- Full daemon suite 89/89.

## Open

Resources/prompts/elicitation, MCP Apps views, remote OAuth — the
remaining CUS-11/12/15 surface.
