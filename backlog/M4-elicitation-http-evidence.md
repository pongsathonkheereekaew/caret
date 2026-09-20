# M4 HTTP elicitation evidence — GET event stream (2026-09-11)

Daemon (`caret-adapter`): `McpHttpClient` opens a long-lived GET `/mcp`
(node:http, not fetch — fetch waits for the body to end) after initialize
when an elicitation handler is registered. The HTTP fixture pushes
`elicitation/create` over that stream; the client POSTs the JSON-RPC
reply; the original `tools/call ask` completes. Same accept/decline
shape as stdio (`hello bob` / `elicitation declined`).

## Proven (suite 120/120)

- HTTP MCP 14/14: previous 11 keepers untouched, plus accept, decline,
  and bearer-gated GET on the auth peer.
- No handler / no GET stream: `ask` still returns the honest tool-level
  error (`needs a server-initiated stream`) — never pretends.
- Fixture flushes `: connected` so headers leave the socket before the
  first event (Node otherwise buffers `writeHead` until a body write).

## Deliberately NOT here

Full OAuth (discovery + PKCE + browser redirect) — blocked-external,
seam unchanged. Server-initiated notifications other than
elicitation/create are not claimed.
