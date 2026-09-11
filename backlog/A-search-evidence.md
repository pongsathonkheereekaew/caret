# Phase A search + transcript evidence (2026-09-10)

Daemon: `search.ts` (`indexableText`, `searchChats`: full-text over
journal events, type/date filters, transparent scoring — head-position ×
frequency, newest-first ties — capped, snippets) + 3 keepers.
Fork: turn rows carry host-measured elapsed (`Turn: completed (42s)`);
Compact toggle hides `tool-done` rows (Expand restores).

## Proven (machine)

- 3/3 search keepers (ranking, filters, caps/empties/misses) + repaired
  honestly: my first `until` expectation miscounted the fixture, and
  `JSON.stringify(undefined-payload)` quoted empties — both fixed in
  code/test respectively, suite 70/70.
- `tsc` 0; 10/10 buttons wired; every posted command has a case.

## Open

- Search UI surface (box, type filter, jump-to) now **implemented** in
  the composer webview + `chat.search` RPC (2026-09-11). Machine: tsc 0,
  session-api keeper (journal hit/miss/filter/corrupt-line). Click/render
  still needs human eyes (H05 script).
- Virtualized transcript (budgets only, no headless measure);
  per-tool expand + per-row elapsed (turn-level only now).
