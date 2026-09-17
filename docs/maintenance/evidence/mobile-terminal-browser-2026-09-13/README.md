# Mobile terminal browser fixture — 2026-09-13

Desktop Chromium opened `scripts/mobile-terminal-browser-smoke.ts` at `http://127.0.0.1:63175/`
and pressed Replay / Live / Send status queries, including OSC `?;?` and OSC 4.

Result:

- the iframe showed `Initial screen` and `Live output continues`
- the renderer messages contained only the `browser-fixture` `ready` message and no `input` after
  the status queries
- this is not an iPhone or cellular run, and it is not checkpoint or full-scrollback restoration

Evidence: [`receipt.json`](./receipt.json), [`fixture.png`](./fixture.png)
