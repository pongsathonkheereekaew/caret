# H05-UI evidence — extension loads, activates, trust-gated (2026-09-10)

Fork commit `78a0e5e` (`extensions/caret`, branch `caret`).
Daemon: `apps/caret-daemon/src/server.ts` (NDJSON stdio protocol verified:
`daemon.ready`, method dispatch, ok/error envelopes).

## Verified by machine

- Extension compiles (`tsc`, exit 0) and is auto-included in dev builds
  (directory scan, not excluded).
- Exthost loads `caret.caret` (global + local lists).
- With `*` activation (temporary): `_doActivateExtension caret.caret`,
  zero errors, `[caret] extension active` in logs.
- Ship state reverted to `onView:caretComposer` (lazy, correct).

## Trust finding (product behavior, kept)

Fresh profiles disable the extension:
`filterEnabledExtensions: extension 'caret.caret' is disabled` — workspace
trust restricted `/tmp` folders. Manifest now declares
`capabilities.untrustedWorkspaces.supported: false` with an explanatory
string: an agent that runs shell commands MUST NOT auto-run in untrusted
checkouts. This is the correct posture (PX-10…13), not a bug.

## NOT yet verified (needs a human click or UI automation)

Composer → daemon spawn → approval card → Accept/Decline → Review/Reject
rendering. No GUI automation harness exists here; manual script below
(Q05 already demands manual interaction review anyway).

### Manual click-through (5 min, on this machine)

1. `~/caret-work/caret-desktop/.build/electron/Caret.app` — open it
   (or `./scripts/code.sh /tmp/caret-click` from `~/caret-work/caret-desktop`).
2. Open folder `/tmp/caret-click` (create it; Trust the workspace when asked).
3. Activity bar → Caret icon → Agents view appears ("Caret ready").
4. Type `create hello-ui.txt containing hello ui, nothing else` → Send.
5. An **approval card** must appear showing the exact shell command BEFORE
   anything runs → Accept. (`hello-ui.txt` appears; Decline must leave nothing.)
6. **Review** → diff document opens naming the file. **Reject** → file
   disappears, status confirms. **New** → fresh session.
7. Report back: anything that didn't match steps 4–6 verbatim.
