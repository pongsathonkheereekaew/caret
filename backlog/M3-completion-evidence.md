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

## Open M3 tail (not claimed)

Multiline/next-edit/cross-file portal (TAB-03…05), Tab keybinding (C-03),
semantic retrieval (SEARCH-02/06), live UI verification of all three flows.
