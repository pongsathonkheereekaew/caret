# Caret follows the OMP line: the version baseline is a floor, not a pin (2026-09-16)

The project's own machine moved to `omp/18.2.1` while the adapter contract was written at
`omp/18.1.18`. The gate accepted only `18.1.x`, so `apps/host` refused the runtime the user
actually has and the real-OMP test failed with `unsupported_omp` (measured in
`evidence/omp-18-2-envelope-probe-2026-09-16/`). The user's instruction was: do not pin the
version, follow OMP as it updates.

## The policy now

`isSupportedOmpVersion` accepts the baseline **or anything newer** — a later patch, a later
minor, a later major — and refuses anything older or malformed. What a runtime can do is read
from its own `ready` frame instead of guessed from its number: the protocol versions it speaks
and the Caret bridges it carries (`caretUiVersion`, `caretTerminalVersion`,
`caretModelRolesVersion`, the editor and native bridges) are all capability-gated, so a runtime
without them degrades honestly. `OMP_SUPPORTED_MAJOR_MINOR` is deleted rather than left as a
second, contradicting policy.

The floor keeps its meaning: an older release than the baseline is refused by name, because the
contract was never run against it, and the error says so
(`Expected OMP 18.1.18 or later; received omp/18.1.17`). A Caret build still packages a runtime
it contract-tested when it was built — following the line is about the runtime a user points
Caret at, not about what ships inside the app.

## What carries the weight instead of the version number

| control | what it does |
| --- | --- |
| `ready` frame capabilities | the adapter asks the runtime which protocol versions it speaks and which Caret bridges it advertises; missing bridges are refused per command with a named reason (e.g. `caret_get_model_roles` on a stock runtime: "This OMP runtime does not advertise the Caret model-role bridge") |
| `scripts/omp-smoke.ts` (G0) | the adapter contract, run against the candidate runtime |
| `scripts/omp-g1-smoke.ts` (G1) | host-side effects on a deterministic loopback |
| `scripts/omp-ui-smoke.ts` | the extension UI bridge contract |

The suites are the acceptance test for a new release; that is why the floor can move without
them being re-pinned per version.

## Verification

All three contract suites were run against the machine's **stock** OMP `18.2.1`
(`CARET_OMP_BINARY=/Users/pond/.local/bin/omp`), the release the old gate refused:

| suite | verdict |
| --- | --- |
| `scripts/omp-smoke.ts` | **exit 0**; its receipt names `"version": "omp/18.2.1"`, the binary sha256, and the adapter source hashes |
| `scripts/omp-g1-smoke.ts` | **exit 0**; host effects and URI writes exercised on the loopback |
| `scripts/omp-ui-smoke.ts` | **exit 0**; extension UI protocol exercised |

Unit gates:

| gate | result |
| --- | --- |
| `bun test packages/omp-adapter/test/version.test.ts` | 6 pass — baseline, later patch, later minor (`18.2.1`), later major (`19.0.0`), whitespace, older patch/minor/major refused, malformed refused |
| `bun test apps/host/test/service.test.ts` | 15 pass — including the real-OMP test that used to fail on this machine, and the rewritten gate tests: "runs on a newer minor line instead of refusing its number" (`omp/18.2.1`) and "refuses a runtime older than the baseline, naming what it expects" (`omp/18.1.17`, message `18.1.18 or later`) |
| `bun run typecheck`, `bun run test`, `bun run test:mobile`, `ci-validate` | clean (the suite's remaining failure is the environmental `rg` one) |

## Files

- `packages/omp-adapter/src/types.ts` — the predicate and its comment (the policy's home).
- `packages/omp-adapter/src/index.ts` — stops exporting `OMP_SUPPORTED_MAJOR_MINOR`.
- `apps/host/src/service.ts` — the start gate's message and comment.
- `apps/host/src/router.ts` — the health endpoint's comment.
- `scripts/omp-smoke.ts`, `scripts/omp-g1-smoke.ts`, `scripts/omp-ui-smoke.ts` — their pre-flight
  gates name the floor instead of a minor line.
- `packages/omp-adapter/test/version.test.ts`, `apps/host/test/service.test.ts` — the tests that
  encode the policy.

## Supersedes

`docs/maintenance/evidence/s2-omp-version-gate-2026-09-15/receipt.json` describes the earlier
policy ("accepts the baseline or a later patch of the same minor line, rejects another minor
line"). That receipt stays as the record of the revision it describes; this one supersedes its
policy, and the file it names (`OMP_SUPPORTED_MAJOR_MINOR`) no longer exists.

## Not verified

- No patched 18.2 runtime was built: `patches/omp/` still applies to the 18.1 source, so a
  *stock* 18.2.1 has no Caret bridges and those surfaces stay off. Re-cutting the patches onto a
  newer OMP source is separate work, and it is what a future *shipped* runtime update needs.
- The iPhone-side effects of a newer runtime were not exercised (no device in this session).
