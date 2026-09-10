# M3 evidence — Tab, inline edit, exact search (2026-09-10)

Fork commits: Tab provider `b763c0f` + schema `e5c7070`, edit/handoff `d9e00c0`,
search `8d8b227`. Extension compiles clean (4 modules emitted).

## TAB-01/02/06/07 — ghost text (shipped)

- `CaretTabProvider`: file/untitled schemes, per-language disable list,
  toggle + 10-min snooze with correct restore, status bar, `caret.tab.*`
  settings. Cancellation aborts the request; **stale guard**: buffer version
  or position moved mid-flight → suggestion discarded, never inserted.
- Backend = measured chat-mode single-line path (F05). No keybinding shipped
  yet — C-03 policy forbids floating `Cmd/Ctrl+K`; needs `when`-scoped
  context keys (M4). Acceptance counting stays in the replay harness, not
  the editor (privacy).

## EDIT-01..04, PX-07 — inline edit (shipped, untested live)

- `caret.inlineEdit`: selection (or cursor line) + instruction → local-model
  proposal → side-by-side diff doc → Apply / Reject / Refine.
- Question heuristic: trailing `?` with no selection routes to Send to Agent
  instead of editing.
- Apply = single atomic `WorkspaceEdit` (one undo stop) gated on
  version+content match (F04 contract); drifted buffer → modal conflict
  choice, never overwrite.
- `caret.generateCommand`: proposal QuickPick → Copy / Run in new terminal /
  Cancel. Execute is always explicit; nothing auto-runs.
- `caret.sendToAgent`: selection + instruction prefill the Agents composer
  (EDIT-03 handoff, no double-apply).

## SEARCH-01/04 — exact search (shipped, flags verified live)

- Bundled `rg --json` (5ms on fixture), literal default, per-result errors
  surfaced (J4 `search.exact` shape: unreadable roots don't kill the run).
- Ignore hierarchy: parent `.caretignore`s → root → imported `.cursorignore`
  (read-only) → `~/.caret/ignore`; `caret.initIgnore` scaffolds the native file.
- Semantic index explicitly deferred (needs embedding endpoint + F-index
  measurement of its own).

## Restarting local Tab serving

```sh
/Users/pond/caret-work/llama.cpp/build/bin/llama-server \
  -m ~/.caret-models/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf \
  --port 8080 --n-gpu-layers 99 -c 4096 --log-disable
```
Stopped after measurement to free ~1.2GB RAM; start on demand for Tab use.

## M3 tail status (2026-09-10)

- [x] Tab keybinding (C-03): `caret.inlineEdit` bound `cmd+k` / `ctrl+k` with
  `when: editorTextFocus && editorHasSelection && !editorReadonly` (fork
  `caret` branch; `tsc -p ./` exit 0). Narrowing rationale: bare-cursor
  `Cmd/Ctrl+K` still starts the upstream chord; Caret takes it only with a
  selection, which is EDIT-01's primary path anyway. Cursor-line path stays
  on the Command Palette. TAB-02 accept/dismiss stays platform-native (no
  override bindings shipped; the user's keybinding governs ghost-text
  accept, word-accept, and dismiss). Runtime CONFLICT-GATE / F01-DUMP checks
  still open per `backlog/command-map.md` — not claimed.
- [ ] Multiline / next-edit / cross-file portal (TAB-03…05): gates unmet, unclaimed.
- [ ] Semantic retrieval (SEARCH-02/06): needs embedding endpoint + F-index measurement.
- [ ] Live UI verification of all three flows.

## Multiline probe (2026-09-10) — REJECTED for V1 with evidence

Harness: throwaway `/tmp/caret-multiline/probe.mjs` (seed 20260910, 20
split points from daemon sources + 5 warmup, chat-mode n_predict 96,
T 0.2, no stop). Server: llama.cpp v0.4.0 + Qwen2.5-Coder-1.5B-Instruct
Q4_K_M, same as F05. Results in `/tmp/caret-multiline/results.json`.

| n | p50 | p95 | empty | ≥2 lines |
|---|---|---|---|---|
| 20 | 1114ms | 1756ms | 0/20 | 15/20 (75%) |

Rates pass a lenient gate, but samples fail validity:

- Truncation at the token ceiling: outputs end mid-token
  (`Effect.provide(boo`, `stats.m`) — shipped ghost text would insert
  broken code.
- Repetition pathology: the same line emitted 3x before the cutoff
  (instruct-model chat-mode loop).
- Latency already over the V1 single-line gates (700/1000) at n=96;
  raising the budget to fix truncation worsens it further.

Decision: V1 Tab stays single-line chat-mode (shipped == measured).
Multiline reopens only on its own track: base FIM quant (F05) or a
stop-at-blank-line + truncation-guard experiment with fresh validity
samples. Server stopped after measurement (RAM).
