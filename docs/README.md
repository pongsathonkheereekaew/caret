# CEDIA documentation

There is exactly **one** authoritative plan and spec:
[maintenance/CEDIA-PLAN.md](maintenance/CEDIA-PLAN.md)

Checkout is `/Users/pond/cedia` on branch `main`.

## Current sources

| Topic | File |
|---|---|
| Per-turn agent rules | [AGENTS.md](../AGENTS.md) |
| **Product definition + architecture + workspace surface contract + SSOT + steps S1-S5 + open work** | [maintenance/CEDIA-PLAN.md](maintenance/CEDIA-PLAN.md) |
| Runtime receipts (scripts write here) | [maintenance/evidence/](maintenance/evidence/) |
| Desktop / OMP pins (`ci-validate` reads this file) | [UPSTREAM-LOCK.md](UPSTREAM-LOCK.md) |
| Workspace identifiers: 198 parents / 75 UI families | [../backlog/requirement-graph.json](../backlog/requirement-graph.json) |
| Per-item evidence referenced by that graph | [../backlog/](../backlog/) |

## Where to start

1. [AGENTS.md](../AGENTS.md) — project rules and invariants.
2. [CEDIA-PLAN.md](maintenance/CEDIA-PLAN.md) — §0 for the definition, then §6 (SSOT), §8 (plan)
   and §10 (what is open right now).
3. The receipts the plan cites, under `maintenance/evidence/`.

## Documentation rules

- **Everything here is written in English.** There are no `.th.md` files and no mixed-language
  sections; a Thai `.th.md` name is a defect, not a convention. User-facing product copy may still
  be localized — documentation may not.
- `CEDIA-PLAN.md` is the only document that decides new work. If the plan changes, change it there.
- **Do not create a second plan or spec anywhere in this repository.** Superseded documents are
  deleted, not archived: git history is the archive, and a live tree with two owners of truth is
  the failure this rule exists to prevent.
- Receipts live in `maintenance/evidence/` permanently, because scripts and tests reference those
  paths by name.
- Any document other than the plan has **no authority**, even if it reads as current.
