# AG-10 Artifacts/demos — implemented, not verified (2026-09-11)

Machine-side slice. Click-open of image/video in the workbench is still open.

## Proven

- `artifacts.ts` classifies image / video / log / file from path, binds each
  item to `runId` + git revision (`postRef` else `preRef`).
- Paths must resolve under the run workDir (symlink escape refused).
- Sources: git diff vs pre-ref, untracked (honours gitignore), plus journal
  fields named path/file/*Path/*File.
- RPC `run.artifacts` returns `{ runId, revision, items }`. Composer
  **Artifacts** lists them; **Open** uses the image/video editor for media
  and a text editor for logs/files. No custom video player.
- Keepers: kind/mime/viewer, missing-path skip, journal extract, symlink
  refuse, fixture mp4. Daemon suite **137/137**.

## Open

- Human click that a PNG opens the image viewer and a `.log` opens text.
- Branch-aware artifact cache beyond the current worktree HEAD.
- Isolated HTML/canvas demo viewer (VIS/PX-22, not this parent).
