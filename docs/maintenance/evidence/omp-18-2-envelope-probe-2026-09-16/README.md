# The machine's OMP moved to 18.2.1; what the pinned adapter answers (2026-09-16)

> **Follow-up:** the policy this receipt measured against was replaced the same day — the
> baseline is a floor now, so a newer runtime is accepted and judged by its `ready` frame and the
> contract suites. See
> [`evidence/omp-version-floor-2026-09-16/`](../omp-version-floor-2026-09-16/).

Found while making the macOS side solid: `apps/host`'s real-OMP test on this machine started
failing with `unsupported_omp`, because the installed binary is now `omp/18.2.1` while
`isSupportedOmpVersion` accepts the pinned line only (baseline `18.1.18`, i.e. `18.1.x`).

The packaged app is **not** affected: it spawns the OMP runtime it ships
(`dist/omp-standalone/omp`, built from the pinned, patched source at 18.1.18), and its host
probes that binary. What this measures is the question the pin's own comment raises: if a user
points Caret at an OMP of a newer minor, is the envelope still the one the adapter was written
against?

## Measurement

A probe outside the repository (`OmpRpcClient` used as-is; nothing in the tree modified)
against `/Users/pond/.local/bin/omp` (stock, unpatched):

| question | answer |
| --- | --- |
| `ready.supportedProtocolVersions` | `[1, 2]` — the same set the pinned build advertises |
| `ready.maxFrameBytes` | `1048576` — unchanged |
| `ready` Caret bridge markers | none (expected: stock OMP has no `caret_*` commands; they come from `patches/omp/`) |
| `negotiate_protocol` v2, `get_state` | ok |
| `get_available_models` | ok (`data.models` present) |
| `get_login_providers` | ok (`data.providers` present) |
| `caret_get_model_roles` | refused by the capability gate: "This OMP runtime does not advertise the Caret model-role bridge" — the honest-refusal path works |
| `isSupportedOmpVersion("omp/18.2.1")` | **false** |

So the RPC envelope the adapter pins is intact on 18.2.1, and the only thing standing between
Caret and a user-installed 18.2 is the version predicate — plus the fact that a *stock* 18.2
has none of the Caret bridge commands (the model picker's option group, the terminal
negotiation, the editor/native bridges), which a supported 18.2 line would need rebased onto
it from `patches/omp/`.

## What this means

- Nothing changes for the shipped app: its runtime is pinned and patched, and the host probes
  that one.
- The failing test is the machine-coupled one in `apps/host/test/service.test.ts`, which reads
  `CARET_OMP_BINARY` or the user's installed OMP; it is a true signal, not flakiness, and it is
  recorded as an open item rather than papered over by skipping.
- Moving the baseline is the documented procedure (`packages/omp-adapter/src/types.ts`: re-run
  `scripts/omp-smoke.ts` against the candidate and move the baseline instead of widening the
  predicate) — but `omp-smoke.ts` itself refuses a non-18.1 runtime up front, so the first step
  is a deliberate, reviewed widening plus a rebase of `patches/omp/` onto the 18.2 source, not a
  one-line change made from here.

## Not verified

- The adapter contract suite was not run end to end against 18.2.1: its own gate stops before
  the first check, and running it requires the reviewed predicate change described above.
- Nothing was measured for a *patched* 18.2 build; the 18.2.1 probed here is stock.
