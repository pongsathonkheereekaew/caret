# Deep IDE plan — Cursor-grade editor rendering on opencode harness

Status: plan (no implementation; extends F04 bridge contract, does not replace it).

## Goal
Cursor-grade UX without proprietary lock-in: multi-file diff overlay, inline proposal widgets, run timeline panel, repo semantic index — all driven by opencode tool events, honoring F04 invariants (dirty-model truth, versioned edits, atomic undo).

## Phases
1. **D1 Proposal renderer** — engine edit → inline diff widget per hunk (accept/reject per hunk, REV-02); reuse F04 decision table; never silent-apply on dirty overlap.
2. **D2 Multi-file overlay** — grouped diff view across touchedPaths from one run; single undo stop per run via checkpoint pair `(fromRef, toRef)`.
3. **D3 Timeline panel** — webview listing tool events per turn (read/edit/test), click-to-jump to hunk; read-only, no state writes.
4. **D4 Semantic index** — local embeddings over repo chunks for retrieval into opencode context; local-first, no code leaves machine by default; incremental re-index on save.

## Non-goals
- No editor fork; VS Code extension + webview only.
- No raw whole-repo restore; undo = `reverseCheckpointDiff` only.
- No cloud index store.

## Acceptance
- Unsaved-edit + proposal + per-hunk reject + run undo passes F04 matrix.
- Overlay opens <500ms for 20-file run (throwaway perf script).
- Index rebuild incremental; full-repo initial indexed once, exclusions honored.
