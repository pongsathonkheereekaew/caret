# M7-export evidence — portable run bundle (2026-09-10)

Daemon (`caret-adapter` branch): `export.ts` (assemble/write/read) +
`run.export{dir, overwrite?}` RPC in `session-api.ts` (goal tracked from
the last `turn.send`; journal = live `seen` tail, capped at 500).

## What it is (and is not)

- Portable `{handoff + journal tail}` for personal reuse (M7 export) and
  the M8/cloud handoff primitive. Assembled from RECORDED state only.
- NOT a restore path: there is deliberately no `run.import` applying a
  bundle onto a checkout (raw whole-repo restore stays prohibited). A
  future import reads for REVIEW (engine-switch reference), never applies.
- Single-file surface: exactly `bundle.json` in the target dir (keeper
  asserts the listing). No path ever comes from bundle data, so a hostile
  bundle cannot escape its directory.

## Rules enforced by keepers

- Refuse overwrite (`refusing to overwrite export`) unless
  `overwrite:true`; missing/corrupt/wrong-version/wrong-shape bundles fail
  with the reason (`no export bundle` / `not JSON` / `version` / `missing`).
- Journal capped at the newest 500 (full history stays in the JSONL).
- `summarizeRunForHandoff` proven against a fixture git repo with a
  fabricated `CaretRun` (real CheckpointStore, zero engine): filesChanged
  from the diff, approval record from `request.resolved` events, baseCommit
  null when unisolated.

## Proven

5/5 export keepers (engine-free) + full daemon suite 35/35 + surface-shape
keeper updated (11 methods). `server.ts` bundle check re-passes via the
suite (session-api imports flow through remote.test).

## Follow-ups (other tracks)

- UI session: `run.export` is live on both transports — composer Export
  affordance is yours (`backlog/UI-parallel-brief.md` scope U2-adjacent).
  Suggested UX: directory picker → `run.export{dir}` → status shows
  `{files} files, {events} events → {path}`; surface refusals as status.
- Live engine-attached export (real `seen` volume, real diff scale) rides
  the next engine-budget run; unit shape is proven here.
