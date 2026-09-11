# AG-02/04/09 — session list, queue edit, plan todos (2026-09-11)

Machine-side slice. Click-through still open (H05).

## AG-02 Multi-project/task list — implemented, not verified

- `session.list` filters (query / archived), pins first, then newest.
- `session.select` / `rename` / `pin` / `archive` / `forget`.
- Stop keeps a metadata row (title/goal); worktree teardown still happens
  in `stopCaretRun`. One live engine subscription per daemon (Codex).
- Composer Sessions panel: filter, Open, Rename, Pin, Archive, Delete.

## AG-04 Prompt queue — implemented, not verified

- Queue already FIFO + Drop; now **Up / Down / Edit**.
- Keepers in `extensions/caret/src/queue.test.ts` (`bun test`).

## AG-09 Task todo/progress — implemented, not verified

- `applyPlanEvent` folds only explicit todo/plan payloads.
- `turn.completed` does **not** mark tasks done (keeper).
- `plan.get` / `plan.revise` + `plan` notifications → read-only todo list
  in the composer (no click-to-complete).
