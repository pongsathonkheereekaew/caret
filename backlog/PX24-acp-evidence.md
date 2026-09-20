# PX-24 ACP evidence — protocol adapter seed (2026-09-10)

Daemon: `acp.ts` mapping Agent Client Protocol JSON-RPC onto the session
API (initialize / token authenticate / session new+prompt+cancel,
review diff as the turn's message content, `caret/approval`
notifications + `caret/approve` answers, engine-event streaming as
`session/update` agent_message_chunk, NDJSON stdio framing via
`serveAcpLines` (shared with `serve-acp.ts`)) + 5 keepers vs stub API.

## Proven

- Negotiate + auth accept/reject; unknown method/envelope codes.
- new→prompt→cancel loop; second-new refused loudly (one live run);
  non-text blocks rejected; dead sessions rejected.
- Approval + engine notifications translated; approve passthrough works.
- Streaming: engine events with text detail become ordered message chunks
  for the live session; events with no live session fall back to
  caret/notify (2 keepers: order/content/session attribution + fallback).
- Stdio framing: blank lines skipped, parse errors get -32700, responses
  round-trip (1 keeper over in-memory streams; daemon-backed e2e stays
  manual).
- Full daemon suite 109/109.

## Honest bounds (V1 scope, in code comments too)

- Text blocks only: image/audio still rejected — `turn.send` is
  string-only, there is no attachment path to forward to.
- One live session: multi-session waits on the session API, which enforces
  one-live-subscription by locked design (single-subscription guard) —
  relitigating that is out of scope for the adapter.
- No ACP-native permission round-trip (extension notification + method
  instead).
