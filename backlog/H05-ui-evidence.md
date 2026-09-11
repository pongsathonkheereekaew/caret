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
   **Must be a git repo** (`git init` + first commit) — empty folders hang
   session.start on worktree create.
3. Activity bar → Caret icon → Agents view appears ("Caret ready").
4. Type `create hello-ui.txt containing hello ui, nothing else` → Send.
5. An **approval card** must appear showing the exact shell command BEFORE
   anything runs → Accept. (`hello-ui.txt` appears; Decline must leave nothing.)
6. **Review** → diff document opens naming the file. **Reject** (on the
   **same** session, before New) → isolated worktree reverses; status
   confirms. Closing the Untitled diff tab is separate. **New** → fresh
   session (Reject after New has nothing to reverse).
7. Report back: anything that didn't match steps 4–6 verbatim.

### Observed 2026-09-11 (partial — network stall)

- Folder was not a git repo at first (silent fail until init).
- After Send: Codex session live, `request.opened` → user Accept →
  `hello-ui.txt` written in isolated worktree with content `hello ui`.
- Then Codex streamed `runtime.warning` / `Reconnecting... waiting for
  network` for minutes; **`turn.completed` never arrived** → UI looked
  frozen after the event list. Explorer on the main folder stays empty
  until Bring Back (isolated-by-default).
- H05 behavior path mostly proven; clean Review/Reject/New still needs a
  turn that finishes without the reconnect stall.

### Follow-up 2026-09-11 (Stop/New + warning surface)

- Daemon: `turn.cancel` + cancel token on `turn.send`; `session.stop`
  flips the token and declines parked approvals; RPCs already forked so
  cancel runs while send waits.
- Extension: Stop/New call `turn.cancel` then `session.stop` (kill daemon
  only on timeout); `runtime.warning` / reconnect → warn tool row +
  throttled status line (3s).
- Re-test: during a reconnect stall, Stop should show `turn cancelled`
  / `stopped` without waiting for network; warnings should appear in
  status, not only as a flood of tool rows.

### Observed 2026-09-11 11:27 (human: pond — "ใช้ได้")

Screenshot of Caret Agents + Review diff on `/tmp/caret-click`:

- **Worked:** session row `hello · live` with Open/Rename/Pin/Archive/Delete;
  Send wrote `hello-ui.txt` (`hello ui`); Review opened a unified diff;
  `item.started` / `item.completed` for that file; `turn.completed` arrived
  (with an error payload — see below).
- **Codex quota:** `runtime.error` — ChatGPT usage limit, retry after
  2026-09-16 09:43. Not a Caret bug; the turn finished as failed.
- **Still ugly (not blockers for this click):** toolbar wraps into one
  mashed line; most engine events render as raw `eventunmapped` JSON;
  Code Mode host missing (`codex-code-mode-host`); todos (AG-09) did not
  appear — Codex used `item.*`, not `todo.updated`.
- Reject / New / queue Up-Down-Edit not in this frame.

### Follow-up 2026-09-11 (timeline noise + item todos)

- Daemon drops `event.unmapped`, `*.stateChanged`, rate-limit and
  settings telemetry from the composer fan-out; `item.started` /
  `item.completed` upsert a read-only todo by title (JSON blobs skipped).
- Composer wraps the toolbar; quota/`runtime.error` also hits the status
  line. Recompile + reload Caret to pick this up.
