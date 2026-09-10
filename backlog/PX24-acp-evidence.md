# PX-24 ACP evidence — protocol adapter seed (2026-09-10)

Daemon: `acp.ts` mapping Agent Client Protocol JSON-RPC onto the session
API (initialize / token authenticate / session new+prompt+cancel,
review diff as the turn's message content, `caret/approval`
notifications + `caret/approve` answers) + 3 keepers vs stub API.

## Proven

- Negotiate + auth accept/reject; unknown method/envelope codes.
- new→prompt→cancel loop; second-new refused loudly (one live run);
  non-text blocks rejected; dead sessions rejected.
- Approval + engine notifications translated; approve passthrough works.

## Honest bounds (V1 scope, in code comments too)

- One message update per turn (no streaming chunks); text blocks only.
- One live session; no ACP-native permission round-trip (extension
  notification + method instead); no stdio entry loop yet (thin `cli.ts`
  analogue tracked open).
