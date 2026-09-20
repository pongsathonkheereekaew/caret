# Delete a chat from the Agents window's session list (2026-09-16)

The user asked for "delete chat" in the right-click menu, which until now offered only
Archive. The base already owns the whole flow - the menu item, the confirmation dialog and
the provider contract - so this slice is the missing three pieces behind it.

## What was already there

- `MenuId.SessionItemContextMenu` action `sessionsViewPane.deleteSession` ("Delete...",
  group `1_edit`), gated on `SessionSupportsDeleteContext`, with the dialog
  "Are you sure you want to delete this session? / This action cannot be undone."
- `ISessionsManagementService.deleteSessions()` grouping by provider and calling
  `ISessionsProvider.deleteSessions(ids)`.
- Our bridge (patch `0010`) declared `supportsDelete: false` and both delete methods threw
  `UNSUPPORTED`, so the item was never offered.

## The three pieces

| layer | change |
| --- | --- |
| host (`apps/host`) | `DurableStore.deleteSession(id)` (row + cascaded commands/events, `PRAGMA foreign_keys=ON`), `CaretHost.deleteSession(id)` (verify → stop the runtime → delete the row → remove `sessions/<id>` and `artifacts/<id>`), and the route `DELETE /v1/sessions/:id` → `{ deleted: true }`. A worktree the session created is left on disk on purpose: it can hold the user's uncommitted work |
| extension (`apps/macos`) | `CaretHostClient.deleteSession(id)`; command `caret.session.delete` (declared in the manifest as "Delete Chat") that maps the session resources the window passes back to host ids (`sessionIdFromUri`), deletes each, then republishes the item collection |
| bridge (patch `0010`) | `capabilities.supportsDelete: true` and `deleteSession`/`deleteSessions` executing `caret.session.delete` with the session resources, followed by `refresh()` so the row leaves the sidebar |

The window's own dialog is the confirmation, so the command deletes what it is given and
reports the result ("Deleted 1 chat.") - there is no second prompt.

## Verification

| gate | result |
| --- | --- |
| `bun test apps/host` | 26 pass, including the new store test (row + commands + events gone, checked with a second read-only connection), the service test (runtime stopped, record gone, transcript and artifact directories removed, second delete is `not_found`) and the HTTP test (DELETE → 200 `{deleted:true}` → transcrip dir gone → GET 404 → DELETE 404) |
| `bun scripts/prepare-desktop.ts` | 30 patches / 18 removals, every digest and reverse-check passes (patch `0010` re-cut for the bridge change) |
| `cd desktop && npm run typecheck-client`, `bun run typecheck` | clean |
| `bun run test`, `check:cursor-parity`, `ci-validate` | 754 pass / 1 environmental fail; parity 340 keys / 0 mismatches; CI-OK |

On screen, packaged app, final revision (CDP + Computer-Use-class clicks, scratch session
created through the host API so no real work was touched):

1. right-click the session row → the menu now reads `Open to the Side · Pin · Mark as
   Unread · Mark All as Read · Archive · **Delete…** · Create Group`;
2. `Delete…` → the base dialog appears ("Are you sure you want to delete this session?
   This action cannot be undone." / Cancel / Delete);
3. `Delete` → notification "Deleted 1 chat.", the row disappears, the *other* row in the
   same project group stays;
4. host API: the session id is gone; `sessions/<id>` no longer exists on disk.

## Not verified / open

- The archive-based `Done` rows and the list filter were not part of this slice.
- `deleteDetachedWorktree`-style cleanup for worktree sessions is untouched: deleting a
  worktree-backed chat leaves its worktree on disk by design.
- The shell (IDE window's Caret composer) has its own session menu with Archive; it does
  not offer Delete yet.
