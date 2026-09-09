# F04 evidence — scoped undo granularity (2026-09-10)

Live probe on real `CheckpointStoreLive` + `GitCoreLive` at pinned `59db80a`
(scratch git repo, throwaway script, upstream tree clean after).

Fixture: commit {tracked.txt=base, user.txt=user base} → capture R1 →
agent delta {tracked.txt=agent edit, +agent-new.txt} → capture R2 →
user delta {user.txt=user edited, +user-own.txt} →
`reverseCheckpointDiff({from: R1, to: R2})`.

## PASS (4/4)

- tracked.txt reverted to base
- agent-new.txt deleted (agent addition undone)
- user-own.txt preserved (untracked user file survives — no `clean -fd`)
- user.txt edit preserved

## Design constraints discovered (binding on H04)

1. **Raw `restoreCheckpoint` is PROHIBITED on user workspaces.** It runs
   `git restore --source … --worktree --staged -- .` + `git clean -fd -- .` +
   `git reset` — whole-repo revert that deletes untracked files. Both live
   callers (`CheckpointReactor` revert, `ProviderCommandReactor` edit-replay)
   use it; Caret's facade must never expose that path for run-undo on a
   workspace containing user data.
2. **Scoped undo = `reverseCheckpointDiff(from=preTurn, to=postTurn)`.**
   Reverse-applies only the run's delta (strict, else 3way on a throwaway
   index with pre-attempt rollback). Conflicted hunks FAIL the undo with an
   explicit error instead of destroying user work — the caller must surface
   conflict UI (REV-02), never retry destructively.
3. Capture itself is safe to reuse: hidden refs, isolated temp index,
   single-flight per (cwd, ref), 180s aggregate timeout.

## Still open (H04 implementation, not spike)

- Touched-path tracking from tool-call events → (fromRef, toRef) pairs per
  run (bridge contract below).
- The EDITOR half (dirty models) — contract written, implementation at H05.
