# Union Alpha Free in OMP — 2026-09-16

OpenCode Zen published a new free stealth model (`union-alpha`, "Union Alpha Free") and the user
asked for it to show in OMP — the harness whose catalogue Caret's model picker reads
(`get_available_models`). The user's own OpenCode workspace is linked to the request.

**Answer: it now shows and it runs, but not because of anything in this repository.** OMP's
catalogue for a gateway is its own policy; the model is a gateway-first id with no route pin, so
the one thing that had to change was the route, and the only lever available outside OMP's source
is the operator's `models.yml`.

## Measured before the change (pinned OMP `00085d4e7`, the user's own key)

| Probe | Result |
|---|---|
| `GET https://opencode.ai/zen/v1/models` | lists `union-alpha` (as does `/zen/go/v1/models`) |
| OMP's bundled zen slice (`packages/catalog/src/models.json`) | 90 rows, **no** `union-alpha` |
| OMP's own resolver for the live gateway lists | both `opencode-zen` and `opencode-go` resolve `union-alpha` to **`openai-completions`** |
| `POST /zen/v1/chat/completions` (Bearer + `x-opencode-session`) | **500** |
| `POST /zen/go/v1/chat/completions`, `/zen/go/v1/responses` | **500** |
| `POST /zen/v1/messages` (Anthropic-style key + `x-opencode-session`) | **200** `{"content":[{"type":"text","text":"ok"}],"model":"union-alpha","cost":"0"}` |
| `POST /zen/go/v1/messages` | 400 without a session header; with one it did **not answer within 100 s** |
| models.dev (`catalog.stencil.so` / `api.json`, live) | has `union-alpha` under `opencode`: npm `@ai-sdk/anthropic`, 262144/131072, reasoning + tool_call |

So the row *was* already listed in OMP (live discovery replaces zen's bundled slice per credential)
and the model would have failed with a 500 on its first turn — the list was there, the route was
not. The gateway serves it on `/v1/messages`, which is the endpoint its docs declare.

## Why this is not a Caret patch

- Per-id routes live in OMP's bundled rules: `packages/catalog/src/compat/rules/runtime/behavior.kdl`
  `api-routes`, which drive both the models.dev descriptor path and the live-discovery mapper.
  `union-alpha` has no pin in the pinned revision **or upstream main** (`60c9a115b2`, checked with
  `git ls-remote` + `git show FETCH_HEAD:…behavior.kdl`: upstream pins `muse-spark-`, `minimax-m3`,
  `gpt-6-astra` — not this id). The misroute is upstream's, in the same class as #8957/#10610.
- §6 of the plan keeps `patches/omp` for surfaces OMP cannot expose (the model-role bridges). A
  catalog route is policy, not a surface; forking it in Caret would make Caret's OMP answer
  differently from stock OMP about what a model *is*.
- Config-level alternatives were disproved, not assumed:
  - `modelOverrides` cannot carry a route — `ModelPatch` has no `api`/`baseUrl` field.
  - Declaring `models:` on the built-in `opencode-zen` id forces a provider-wide `baseUrl`
    (`models-config.ts`: `"baseUrl" is required when defining custom models`), and
    `providerOverride.baseUrl` then wins for **every** discovered zen row, moving the rest of the
    roster off the `/v1` paths their transports build.
  - A custom provider id loses the free-tier gate header: `x-opencode-session` is set only for
    `provider === "opencode-go" || provider === "opencode-zen"`
    (`packages/ai/src/providers/inference-headers.ts`), and without it the gateway answers
    `400 MissingSessionID: OpenCode's free tier can only be used in OpenCode`.

## What shipped

`~/.omp/agent/models.yml` (operator config, not repo code; backup
`models.yml.bak-20260916164053`, the directory's own `.bak-<ts>` convention):

```yaml
  opencode-zen:
    baseUrl: https://opencode.ai/zen/v1   # the built-in value, repeated because a `models:` list requires one
    apiKey: <the same key the go provider already carried>
    models:
      - id: union-alpha
        name: Union Alpha Free
        api: anthropic-messages
        reasoning: true
        input: [text, image]
        contextWindow: 262144
        maxTokens: 131072
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
```

The Anthropic transport normalizes `…/zen/v1` to `…/zen` and appends `/v1/messages`
(`normalizeAnthropicBaseUrl`), which is the exact call that answered 200 above.

`~/.omp/agent/config.yml` (the settings file, a symlink into the cedia project; backup
`config.yml.bak-20260917010508`) lost its `retry:` block on the same day, at the user's request —
the automatic model fallback (`fallbackChains.default` → `opencode-go/muse-spark-1.3-contributor`,
`opencode-go/deepseek-v4.1-flash`). Read back through OMP's own loader (`Settings.init()`):
`retry.fallbackChains = {}`, with `retry.modelFallback` deliberately left `true` so a chain written
later (the user plans to set it from a Caret surface) works without a second edit. The picker's own
call was re-measured after the edit: OMP boots and the list is unchanged.

Note that this file — not the repo — decides what the picker shows: `enabledModels` is an
allow-list (six rows today) and `disabledProviders` currently carries `opencode-zen`, so
`opencode-zen/union-alpha` appears only once those two keys are edited. Both are the user's to
curate.

## Verified

| Check | Result |
|---|---|
| Live turn through the pinned runtime — `./dist/omp/omp --model opencode-zen/union-alpha --no-tools --no-rules --no-skills -p "Reply with exactly: caret-union-ok"` | **`caret-union-ok`** |
| The live config through OMP's own `ModelRegistry` (the object `get_available_models` projects — `rpc-mode.ts` → `session.getAvailableModels()`) | `opencode-zen` 71 rows; `union-alpha` → `api anthropic-messages`, `baseUrl https://opencode.ai/zen/v1`, name `Union Alpha Free`, key resolves |
| Every other zen row | keeps the catalog's own route (`big-pickle`, `claude-fable-5`, … all `@https://opencode.ai/zen/v1`) |
| `get_available_models` through Caret's own adapter (the picker's call) with the user's settings | **6 rows** — their `enabledModels` allow-list (cursor, commandcode, opencode-go ×2, openai-codex ×2). Nothing zen, because `disabledProviders` carries `opencode-zen`. |
| The same call with an OMP `--config` overlay that drops `opencode-zen` from `disabledProviders` and adds `opencode-zen/union-alpha` to `enabledModels` | **7 rows**, the sixth being `opencode-zen/union-alpha` (the overlay is OMP's own flag, so `config.yml` itself was never touched) |
| Pinned OMP tree | untouched — the probe files were temporary and deleted; `git status` shows only the applied Caret patch |

## Not confirmed

- **`opencode-go/union-alpha` is still a dead row** in the picker: OMP routes it to chat
  completions, which the gateway answers 500 (and its `/messages` lane did not answer in 100 s).
  That is upstream OMP catalog policy — see plan §10.
- The zen credential also brings zen's **whole live roster (71 rows)** into the picker. That is
  OMP's normal credentials-only behaviour, not something this slice trimmed.
- The row was not read off the running app's picker: no host was running, so the measurement is the
  registry the RPC projects from. The app needs a session open (a registry refresh) to show it.
- The gateway gates free-tier lanes on `x-opencode-session`; the static probe value worked, and
  OMP's own per-session header is what the live turn used.
