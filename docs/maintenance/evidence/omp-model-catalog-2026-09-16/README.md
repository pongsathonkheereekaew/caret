# OMP really does advertise models — the picker was disabled because no OMP process was there to answer (2026-09-16)

The open question carried from the previous round: "the composer's model picker renders disabled as
`Models, Auto` … Either OMP advertises no models (provider/credentials) or our bridge drops them."

**Answer: OMP advertises 6 models and the bridge does not drop them — but there was no OMP process
to answer the question.**

## Measured before the fix (host API, no token printed)

`GET /v1/health` → `ompVersion 18.1.18` · `GET /v1/sessions` → 9 sessions, status `idle`/`stopped`
(**`idle` in the host record does not mean the process has not started** — sessions that can answer
and sessions that cannot both report `idle` ⇒ the list alone does not tell you which ones can
answer).

| What was sent | Before start | After `POST /v1/sessions/:id/start` |
|---|---|---|
| `get_available_models` | `status: "not_dispatched"`, `error: "Start or reconcile the OMP session before sending commands"` | `status: "completed"` → `ack.data.models` **6 rows** |
| `get_state` | — | populated (`result.data` / `ack.data`) |
| `get_login_providers` | — | `data.providers` **72 rows** (`{authenticated, available, id, name}`) |

6 models (both `api` and `provider` live in the same row): `cursor-agent` ×1,
`openai-completions` ×2, `openai-responses` ×1, `openai-codex-responses` ×2 — for example
`cursor-grok-4.6` (`baseUrl: https://api2.cursor.sh`), and the authenticated providers include at
least `openai-codex`.

Two bugs found by measurement (in different layers):

1. **The layer that made the picker empty**: `fetchGlobalOmpModelSnapshot` / `snapshotForInputState`
   sent `get_available_models` to a session the host had **never started** ⇒ the host answered
   `not_dispatched` (the host's own guard, not OMP's) ⇒ an empty snapshot ⇒ the picker was honestly
   disabled. The existing normaliser (reading `data.models`) **was already correct** — the broken
   layer was "nobody starts the process".
2. **Starting changes the incarnation**: sending a command with the old incarnation after a start
   returned HTTP **409 `stale_incarnation`** ⇒ a retry must read the session `start` returned, not
   the refused one (the same route `runTurn` already took: `const running = await
   client.startSession(id)` and then `running.incarnation`).

## Fix

`apps/macos/src/chat-sessions.ts` — `snapshotWithOmpRuntime(client, session, log)`:

1. Send `get_available_models` once through the session that will serve as the query envelope.
2. If it answers `not_dispatched` → `startSession` **once**, then re-read the catalogue with the
   session that returned (the new incarnation). If the host is down (throws), do not start, because
   starting would not help → return an empty snapshot.
3. If the start fails → return the snapshot from the refused answer (empty) ⇒ still honestly
   disabled, as before.

Both paths use it: `fetchGlobalOmpModelSnapshot` (the registration/draft probe) and
`snapshotForInputState` (on session open). `fetchOmpModelSnapshot` gained a `catalog` option so the
successful path **reuses what the probe already read** instead of sending `get_available_models`
again.

The cost paid: opening the picker in a window that has never sent a prompt starts one OMP process —
the same process the user's first prompt would have started, and the host keeps it.

## Confirmed

| Layer | Result |
|---|---|
| unit (3 new tests in `apps/macos/test/chat-sessions-map.test.ts`) | refused → start → retry with `inc-live`, getting a model; warm → does **not** start and sends the catalogue exactly once; host down → no start and empty |
| suite | `bun test apps/macos/test packages/omp-adapter packages/relay apps/host` → **740 pass** (was 737) · `bun run typecheck` clean |
| live host | after the fix, **3 sessions** can answer the catalogue at runtime (before, only 1 — the one started by hand) ⇒ the ensure path really works |
| on screen (packaged app) | after opening a session the picker has a real rect of **139×22**, `disabled: false`, label = a real model, **`DeepSeek V4.1 Flash`** |
| on screen: menu (real mouse through Computer Use) | clicking the picker produced a list box with `Search models` and a `Current model` mark, and the rows: `DeepSeek V4.1 Flash (Command Code)` · `Grok 4.6` · `GPT-5.6-Luna` · `GPT-6-Astra` · `DeepSeek V4.1 Flash` · `Muse Spark 1.3 Contributor` |

The menu was closed with `Escape` (real mouse/key) with no state left behind.

## Not yet confirmed

- **The composer in draft state (no session open)**: the `model-picker-split` element is still a
  `0×0` rect and `disabled` — that is the new-chat widget's condition, not the catalogue's (it works
  once a session is open). Whether the empty state should show the catalogue is a decision still to
  be made.
- **A fresh install with no host session at all**: there is no session to probe ⇒ honestly empty by
  design. (Cursor shows models before there is any work; matching that needs a catalogue read path
  not tied to a session, such as a host-owned `POST /v1/models`, or reading OMP's `models.db`
  cache.)
- Whether `set_model` really writes back — this round confirmed "read the catalogue, display it and
  select from it", but did not press a model and then check `get_state` for a real change (patch
  `0014` already has write-through plus tests).
- No comparison against OMP's `omp models` CLI (Orca uses that route); this round used the
  harness's RPC route, which is our SSOT, and added no second path.
