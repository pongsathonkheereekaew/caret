# M4-MCP-HTTP evidence — streamable transport + auth seam (2026-09-10)

Daemon (`caret-adapter` branch): `McpHttpClient` in
`apps/caret-daemon/src/mcp-http.ts` + fixture
`mcp-http-fixture-server.ts` (node:http, no deps) + 8 keepers in
`mcp-http.test.ts`. Same owned-wire posture as the stdio client (no SDK).

## Covered

- initialize over SSE with `Mcp-Session-Id` capture; JSON + SSE response
  parsing (server speaks both: SSE for initialize/calls, JSON for
  ping/list/errors — the client must handle either per response).
- tools/list validation, tools/call result validation, tool-level errors,
  unknown-tool protocol errors (`McpError`, same messages as stdio).
- Cancellation via `notifications/cancelled` (sleep returns `cancelled`,
  `isError: true`); local timeout (`timed out after Nms`, same wording).
- Reconnect after DELETE (fresh session id, works again).
- Transparent recovery: server-side session drop (404) → re-initialize
  once → replay the original message (keeper hits `/test/drop`, same
  call succeeds).
- Auth seam: 401 without a token (`McpError` 401, no silent retry);
  bearer hook (`auth.token()`) passes on the gated peer.

## Deliberately NOT here

Full OAuth (discovery + PKCE + refresh + token store): needs a real
provider, a browser redirect, and user approval — blocked-external by
nature. The seam is ready (header injection + 401 surfacing); the flow
is its own track. GET-stream server-initiated notifications also out
(request/response only, documented).

## Proven

Full daemon suite 22/22 (9 worktree + 5 stdio MCP + 8 HTTP). Stdio 5/5
untouched. Setup hooks (OS-specific) remain the last M4 tail item.
