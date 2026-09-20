# Review + Plan models evidence (parity §5/§6 data halves, 2026-09-10)

Daemon: `review.ts` (ReviewState machine + finding lifecycle) and
`plan.ts` (revisioned docs + task checklist + Build binding to the exact
revision) + 4 keepers. Pure, no I/O, no model.

## Proven

- Review walk to merged; jumps blocked (incl. approved→merged,
  merged→anything); findings add/dismiss/fix with validation.
- Plan walk with legal intermediate states; revision resets build
  binding (never builds stale); task tracking; runId required.
- Full daemon suite 84/84 with these.

## Open

Rendering (Monaco overlay, plan doc UI), research/question flows,
auto-review depth, plan version history UI, Build executor.
