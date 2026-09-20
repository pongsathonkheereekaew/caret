# Reading Orca (stablyai/orca) against Caret (2026-09-16)

Question: what can Orca help us build?

This receipt separates **observation** (what that repo has or writes, with paths) from
**inference** (what Caret could do with it). It is not a plan and has no authority over work — the
plan is still [`CEDIA-PLAN.md`](../../CEDIA-PLAN.md).

## How it was read

- Cloned `https://github.com/stablyai/orca` at commit `b8d4cde0`, license **MIT** (`LICENSE`).
- Read `README.md`, `AGENTS.md`, `docs/reference/*.md` (41 files), `docs/STYLEGUIDE.md`,
  `cloud/README.md`, the structure of `src/{cli,main,preload,relay,renderer,shared}` (main 8.9k
  files, renderer 10k files), `mobile/`, `package.json`, and `skills/` + `skill-guides/` +
  `skill-stubs/`.
- Re-check with `git -C <clone> log --oneline -1`; it must give `b8d4cde0`.

## What Orca is (observation)

Orca is an orchestrator for multiple agent CLIs, not an IDE — "run Codex, ClaudeCode, OpenCode or Pi
side-by-side — each in its own worktree" (`README.md`), and it accepts any CLI that runs in a
terminal (`omp`/oh-my-pi is on the list).

| Layer | Orca | Caret |
|---|---|---|
| UI | Electron + React (Tailwind/shadcn, tokens in `src/renderer/src/assets/main.css`) — **not a VS Code fork** | Code-OSS workbench + `patches/desktop/*` |
| Editor | `monaco-editor` + `@monaco-editor/react` (dependencies in `package.json`) | the real workbench editor from Code-OSS |
| Agent | Two modes: `structured` (native chat reading the CLI's session/journal files) or `terminal` (PTY + status through hooks/OSC) — `src/main/agent-launch/agent-launch-mode.ts` | **structured only**, through OMP (host HTTP → command envelope) |
| Remote | SSH worktrees + a paired runtime (`orca environment`) + relay + mobile + push gateway | `apps/host` + `packages/relay` + `apps/ios` |
| Docs | `AGENTS.md` + 41 invariant documents in `docs/reference/` | `AGENTS.md` + one plan + `evidence/` |

**Architectural summary**: Caret took the route Orca did not (forking the workbench so the IDE
matches Cursor) ⇒ **Orca's UI code is unusable for us**. What that repo really sells is *discipline*
and *knowledge it already paid for* — especially running agents across machines and handing a
session to a phone.

## What is genuinely usable, ordered by value

### 1. OMP surfaces — this could unblock our model picker immediately (highest)

Observation: Orca knows OMP's subcommands as a data set
(`src/main/pty/omp-shell-wrapper.ts` plus snapshots in
`src/main/__fixtures__/shell-wrapper-snapshots/`): `models`, `tiny-models`, `usage`, `stats`,
`token`, `auth-broker`, `auth-gateway`, `config`, `plugin`, `agents`, `acp`, `worktree`/`wt`,
`search`, `grep`, `read`, `commit`, `shell`, `ssh`, `say`, `install`, `update`, `bench`, `gallery`,
`grievances`, `dry-balance`, `ttsr`, `q`, `join`. It also **overlays OMP's SQLite**
(`src/main/pty/omp-sqlite-overlay.ts`: `agent.db` plus `-wal`/`-shm` under `PI_CODING_AGENT_DIR`) so
a user's `/login` writes to the real store rather than a throwaway overlay, and it reads session
names from the files OMP persists itself (`docs/reference/omp-history-titles.md`: `session.title`,
version-1 `title` slots, `title_change.title`, legacy `session_info.name`, with a user-set name
beating an automatic one and timestamps preventing an older rename from overwriting a newer one),
with a smoke test that runs read-only against a real OMP checkout.

Inference for Caret: our open question (the picker shows "Models, Auto" because
`get_available_models` needs a started session) could be answered by reading **`omp models`** or by
reading `agent.db`/the journal directly the way Orca does — with no session needed. The same route
gives session names, history and search in the sidebar while the window is empty, which we do not
have today (our empty window shows an empty state).

### 2. Execution boundary: `live` / `unverifiable` / `exited`

Observation: `docs/reference/ssh-execution-boundary.md` sets two rules — **never substitute
silently** (work on a remote repo must not fall back to running on the client machine, because that
answers for the wrong repo), and **never claim what you cannot observe** (loss of contact is not
`exited`; the vocabulary is fixed to `live`/`unverifiable`/`exited` with no synonyms, and `exited`
requires positive evidence from the host that owns the process). "Evidence must be measured in the
unit the destructive action operates on." A disconnect is a detach, not a dispose. Its relay
namespaces by bundle hash ⇒ **updating the app makes old terminals permanently `unverifiable`** (an
expensive lesson in `#13852`), whereas a daemon peer model can use a *semantic* protocol version and
attach an older version.

Inference: this is the theory behind our `apps/host` + `packages/relay` + mobile continue, and it is
the answer to §4's "honest-unavailable state" — separate "we could not ask" from "it is gone", and
never silently fall back to running locally. We should adopt this vocabulary in
`packages/protocol` before iOS ships.

### 3. Wire-compatibility rules and cross-version harness

Observation: `docs/reference/remote-wire-compatibility.md` gives three rules — (1) adding an
optional field is safe **as long as every reader treats it as optional** (if a new client *requires*
it, it breaks against an old host); (2) a new opcode is **not** safe, because the decoder returns
`null` and the frame is dropped silently ⇒ negotiate capability instead (like `SetOutputPaused`),
treat opcode numbers as permanent and never reuse them; (3) changing the *content* a host publishes
is also a wire change (an old client reads the missing field as `undefined`). It also states "never
write that the old side has nothing" (the baseline moves every release) and requires deriving the
baseline from a real build, with a `tests/e2e/cross-version-wire/*` suite that runs two real builds
against each other in both directions.

Inference: Caret will certainly update host, desktop and iOS separately ⇒ these three rules belong
in `packages/protocol` before a real paired client exists, and "derive the baseline, do not hardcode
it" is why such a suite does not rot across releases.

### 4. One status store per execution host

Observation: `docs/reference/agent-status-store.md` — an audit found **6 producers, 3 consumers and
three copies of the row within a single main process** ⇒ the rule: the execution host owns status in
**one store**, every reader (sidebar, `worktree ps`, mobile, dashboard) subscribes, precedence is
chosen **once at write time** with provenance, readers are left with presentation policy only
(30-minute decay, unread, dismissal), mirroring is not merging (a client never writes back),
hydration honesty (`restoredUnconfirmed` must not be read as live truth), and dismiss/exit removes
the same row on every surface.

Inference: this matches our §6 SSOT and the session status that is currently spread across host,
extension, sidebar and mobile. If we really build mobile continue, this structure has to come first,
otherwise the phone and the desktop disagree about the same status — a bug they already paid for.

### 5. A reliability-contract receipt template

Observation: many documents close with the same shape — **Invariant (with an id such as
`agent-session.status-host-ownership`) · Failure source · Oracle · Gate · Provider/platform coverage ·
Performance budget · Diagnostics · Residual gaps** — and their tests use **boundary-evidence tables**
(`runtime-file-base64-padding.md`: input → before → after for every case), a **caller census**
(walking every caller for reachable/unreachable) and ratchet tests that fail when a forbidden import
appears (`src/shared/child-process/` must not import `child_process` directly).

Inference: our receipts currently describe "what was done / what was confirmed" but have no gate,
coverage or budget that lets someone else re-check them. Cheap and immediately useful: add invariant,
gate, coverage and residual-gaps sections to new receipts (starting with this round's) — it also
turns our "not yet confirmed" items into closable entries instead of floating paragraphs.

### 6. Transcript fixtures for rules that read the agent screen

Observation: `docs/reference/agent-pty-transcript-capture.md` — a recorder that captures **raw
bytes** from the PTY (no escape stripping, no `\r` folding, no rewrapping) into a fixture plus a
`.meta.json` sidecar (version, PTY size, account), ends capture with `Ctrl+]` *while the dialog still
owns the screen*, includes a secret scanner, **redacts at the same length** (because length is
evidence), and a `config/scripts/pty-transcript-secret-scan.test.mjs` scans every committed fixture.
The lesson: fixtures that have passed through a renderer or clipboard contain **no escape bytes and
no carriage returns** ⇒ they can support wording rules but are not evidence about repaint or
alt-screen.

Inference: OMP in our window shows approvals and questions as TUI text, so our "waiting for an
answer / blocked" rules must be written against a real transcript rather than a remembered screen.
The same technique verifies `omp` readiness and version, and gives G0 test fixtures with no provider
calls (consistent with our `AGENTS.md`).

### 7. IME patterns (Thai/CJK users will hit these)

Observation: `docs/reference/ime-regression-checklist.md` — the contract: from `compositionstart`
until `compositionend`/blur, **the browser owns the textarea**; async results (attachment, upload)
must queue at a single sink and adopt the DOM before one flush; transient state must be explicitly
scoped (the placeholder-mask hashtag uses a scalar `activeSessionId` because xterm renders one
composition view); tests need native Korean/IBus evidence separate from synthetic DOM events.

Inference: our composer is a real textarea and our Apps panel has a terminal (xterm) ⇒ both need
this contract before anyone uses a composing language (Thai does not compose, but CJK and Korean
do). It saves enormous time because this list is four bugs they already paid for.

### 8. Skills: a per-provider path registry and an intake process

Observation: `docs/reference/agent-skill-provider-paths.md` — a deliberately small registry,
confirmed from official documentation only: Codex reads `$HOME/.agents/skills` and
`.agents/skills` directly ⇒ nothing needs placing for it; Claude Code needs `.claude/skills`
reconciled (POSIX symlink / Windows junction / copy fallback with drift detection) and
**the path table must never be synced automatically from upstream** — a provider that changes
semantics goes through review. There are separate files for the threat model and the skill-sharing
upstream boundary (`sharing-agent-skills.md`, `agent-skill-sharing-threat-model.md`,
`agent-skill-sharing-upstream-boundary.md`).

Inference: our §4 includes "skills/hooks catalog exactly as OMP advertises it" — the path registry
plus an intake process is what must exist before users can share skills across projects or
machines, and it warns against deriving the table from guessed behaviour.

### 9. Relay, mobile and push (things we have not built but will)

Observation:

- Regional placement (`docs/reference/relay-regional-placement.md`): discard one warm-up `/health`
  per origin, sample three times, compare by the minimum, cache for 24 hours, switch region only
  when the new one is meaningfully faster, and **if no competitor can be measured at all, send no
  hint rather than picking the single survivor** (no hint means the director default, not neutral);
  send only `preferredRegion`, never latency, IP or pairing.
- `cloud/`: the relay contract as a separate package, director and cell from one image
  (`ORCA_RELAY_ROLE`), a `relay-fence-broker` (an IAM-only service holding the mutation lease), an
  ops console and an incident monitor.
- Push gateway: the phone holds no gateway credential at all — the host authenticates with the same
  X25519 key as the relay through an encrypted challenge, issues a 24-hour session, then registers
  the phone's push token (APNs/FCM), with a per-host quota and immediate deregistration when
  Apple/Google reports it unregistered.

Inference: our `packages/relay` + `apps/ios` will have to decide region, lease and push the same way
— this *design* transfers directly (especially "no hint beats a wrong pick" and a push path that
holds no credential). The code is TypeScript in a different workspace and could be ported in parts
with MIT credit.

### 10. Terminal: xterm patches and a daemon-backed PTY

Observation: `docs/reference/xterm-patch-regeneration.md` (292 lines) — the canonical xterm patch
source is the single place edited by hand, and the bundle patch **and** the lockfile are regenerated
together; the terminal daemon is a separate process
(`docs/reference/windows-daemon-host-relocation.md`) so scrollback survives a restart; and
`docs/reference/spinner-rendering-performance.md` plus `renderer-agent-status-performance.md` bound
renderer work per status change.

Inference: we already have "canonical patch + mandatory regenerate" (`patches/desktop/` with digests
in `manifest.json` and `desktop-patch-set.test.ts`) ⇒ their document is a model for writing *patch
rules* others can follow (ours are in §6 of the plan but are not yet a single document an agent
finds). And "the terminal survives a restart" is a feature Cursor users expect — Code-OSS already
gives us some scrollback, but that has to be measured before it is claimed.

### 11. Design-token enforcement → matches our queue item 4

Observation: `AGENTS.md` + `docs/STYLEGUIDE.md`: tokens are canonical in one file, raw palette
colours are forbidden, restyling a primitive in `components/ui/` is forbidden, lint fails when
Tailwind cannot generate a class, and a "changed-lines gate" blocks only the edited lines because
full linting is too expensive.

Inference: our item 4 (injecting `--caret-*` at the workbench level instead of relying on CSS
fallbacks) should ship with their kind of ratchet test: canonical is `CARET_TOKENS`, CSS may not
declare a duplicate value, and `check:cursor-parity` must read the same source — written this way,
item 4 will not come back for a second fix.

### 12. Worktrees and Git, relevant when we build bring-back

Observation: `docs/reference/worktree-scan-fingerprint.md`,
`malformed-worktree-registration-removal.md` and `git-compatibility.md` (a Git 2.25 baseline plus a
`GitCapabilityCache` scoped per host with narrow predicates that never retries a command known to be
unsupported), and `AGENTS.md` forbids enumerating every ref and running `git ls-tree -r` per ref
(gigabytes before the `sort`).

Inference: our §4 has a worktree/branch bring-back receipt ⇒ before writing it, adopt (a) a per-host
capability cache and (b) a bounded scan rule, or we will repeat the same mistake.

## What we should **not** take

- **Orca's renderer/UI code** (React + Tailwind + shadcn): a different architecture from our
  workbench, and the root difference is that it never had to match Cursor at the AX/DOM level while
  we do.
- **A PTY-first agent model as the default**: Orca treats an agent as a terminal first and adds
  structured chat on top; Caret is bound to OMP as the only harness and must be structured (OMP's
  transcript). But its *fallback pattern plus receipt* (`agent-launch-mode.ts`: pick a mode from
  preference and then **degrade with a receipt explaining why** instead of failing) should be applied
  to our §4 honest-unavailable.
- **Cloud/parallel worktree orchestration as product scope**: we have already decided to skip
  Cursor's cloud and subagents — but our §4 does include OMP's subagent lineage ⇒ keep only *reading*
  lineage, not orchestrating competing agents.
- **Deep Windows/WSL/EDR support**: Orca must support three OSes (7 documents on it); we do not yet
  — read it when we get there.

## Recommended order (inference, tied to our queue)

| Order | Work | Why first | Size |
|---|---|---|---|
| 1 | ~~Read `omp models`/`omp usage` and `agent.db` (Orca's way) to unblock the model picker~~ **partly done 2026-09-16** — item 1 is what started the measurement, and it showed we do not need to leave the RPC route at all: OMP already advertises 6 models through `get_available_models`, but a session the host has not started answers `not_dispatched` ⇒ fixed at the cause (`snapshotWithOmpRuntime`), see [omp-model-catalog-2026-09-16](../omp-model-catalog-2026-09-16/README.md) · **still remaining from this item**: session names/history/search from the files OMP persists (not done) | Closes a long-standing open question and gives the empty window content | small-medium |
| 2 | Add invariant/gate/coverage/residual-gaps sections to new receipts, plus a token ratchet test (queue item 4) | Cheap, and upgrades discipline across the project | small |
| 3 | Adopt `live`/`unverifiable`/`exited` and "no silent substitution" in `packages/protocol` before mobile continue | Much more expensive to fix later | medium |
| 4 | The three wire-compatibility rules plus a cross-version harness with a derived baseline | Before the first paired iOS build ships | medium-large |
| 5 | `omp` transcript fixtures (approval/ready) and the IME contract for composer and terminal | Real evidence is needed before claiming a screen was observed | medium |

## Not yet confirmed (our side)

- `omp models`/`omp usage` were not run on this machine ⇒ we still do not know what output the OMP
  18.1.x we install actually produces (Orca reads a 15.x version per a comment in
  `omp-shell-wrapper.ts`). Measure before designing.
- Orca's source was not read at the implementation depth of its structured session (journal schema,
  RPC); this round relied mainly on documents and structure.
- The per-file licensing of `cloud/` versus `src/` was not compared before any code port (the README
  claims MIT for the whole repo).
