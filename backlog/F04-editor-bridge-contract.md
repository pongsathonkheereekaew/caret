# F04 contract — versioned editor bridge (for H04/H05 implementation)

Status: contract (API verified at pinned Code-OSS `3e078a3`,
`src/vscode-dts/vscode.d.ts`; no implementation yet).

## Invariants

1. **Dirty models are truth.** Before applying any engine edit to `path`,
   the bridge reads the live `TextDocument`: `version`, `isDirty`, `getText`.
   Hash is computed over the MODEL text, never blindly over disk. A
   filesystem watcher never overwrites a dirty model (G-BUF-01).
2. **Every engine edit is versioned.** Tool-call edit payloads must carry
   `path + baseContentHash + baseModelVersion`. The bridge rejects application
   when the live model matches neither base hash nor base version.
3. **One logical edit = one `workspace.applyEdit`.** Single undo stop per
   agent edit (`WorkspaceEdit` + metadata), so reject/undo is atomic and the
   user's own undo stack is never interleaved.
4. **Checkpoint pairing.** Pre-turn: adopted hidden-ref capture. Post-turn:
   capture + record `(fromRef, toRef, touchedPaths from tool events)`.
   Undo a run = `reverseCheckpointDiff(from, to)` ONLY (F04 evidence);
   raw whole-repo restore is prohibited on user workspaces.

## Decision table (apply path)

| Live model state | Action |
|---|---|
| Clean, hash == base | apply via `applyEdit` |
| Clean, hash != base (disk moved under us) | re-capture base, re-resolve intent; apply only if still clean at new base, else conflict UI |
| Dirty, model text == base text (user hasn't typed, view-only dirty flag impossible — treat as clean path) | apply via `applyEdit`, dirty flag preserved by editor |
| Dirty, user typed elsewhere in file | three-way reconcile (base → model vs base → engine edit); non-overlapping → apply, overlapping → conflict UI per hunk (REV-02) |
| Dirty, engine edit targets exact user-typed range | conflict UI, engine edit shown as proposal; NEVER overwrite |
| Untracked agent-created file, user created same path meanwhile | conflict UI (two creators); never delete user file via undo of the other run |

## Event wiring (extension side)

- `workspace.onDidChangeTextDocument` → track `(uri → version)`; content
  changes feed the hash check and the reconcile diff.
- `workspace.textDocuments` scan on session start → initial dirty set; any
  dirty file at run start is excluded from silent-apply for overlapping ranges.
- Notebook cells (`NotebookDocument` versions, `:15491`) and custom editors
  (`:19321`) follow the same table; binary files are never text-merged —
  conflict UI only.

## Acceptance (feeds Q01 fixtures)

Unsaved edit + tool edit + undo; rename/CRLF/encoding/symlink/binary/case
matrix; reject-hunk-after-user-edit; two runs racing one file (lease owner
wins, loser gets conflict UI, no interleaved writes).
