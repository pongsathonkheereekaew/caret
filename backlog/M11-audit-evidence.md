# M11 audit evidence — read-only trail over the journal (2026-09-10)

Daemon: `audit.ts` (`buildAuditTrail`, `approvalDecisions`,
`countByType`) + 2 sync keepers. Pure, no I/O — the caller reads JSONL.

## Rules pinned

- Every row carried: unknown/missing `t`/`type` sort stably first with
  `""`/`"unknown"` markers (an audit that drops rows is worse than none).
- Approval record uses the handoff rule (last decision per
  `requestType`); payloads summarized (approvals as `type → decision`,
  runs as workdir, rest truncated to 200 chars).
- Full daemon suite 51/51. Team policies/SSO/budgets/attribution need an
  org + accounts (blocked-external); the trail is their future input.
