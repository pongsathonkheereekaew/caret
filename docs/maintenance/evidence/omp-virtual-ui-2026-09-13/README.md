# OMP virtual UI subprocess acceptance

The receipt in [`receipt.json`](./receipt.json) records a real subprocess run against the Caret development OMP launcher (`dist/omp/omp`) with `CARET_RPC_VIRTUAL_UI=1` and the pinned source revision `00085d4e7dfdcfbf302c122fa2682b410a0f43d1`. The trusted extension and model provider are temporary fixtures; the model is a loopback HTTP server and performs no external inference.

Run from `source/`:

```sh
bun packages/collab-web/scripts/build-tool-views.ts
bun scripts/omp-virtual-ui-smoke.ts
```

The probe covers:

- a raw RPC client sending a prompt before protocol/virtual-terminal negotiation and receiving the bounded `caret_initializing` response;
- ready capability advertisement and `caret_terminal_negotiate` lifecycle;
- `session_start` custom UI waiting for negotiated terminal input;
- the in-process `CustomEditor` draft being rendered and updated by terminal input, with `getEditorText()` observing the edit;
- an extension slash command completing through the same in-process TUI factory;
- the model-facing `bash` wrapper delegating to OMP's native `ctx.invokeTool` with `pty: true`;
- native PTY output through the negotiated virtual terminal and cancellation through RPC `abort`;
- EOF closing a pending custom UI and a queued prompt without requiring a signal kill;
- CaretHost `startSession` while custom UI is pending, plus durable host delivery of terminal input.

The probe does not certify visual Mac/iPhone rendering, cellular relay, signing, production editor buffers, or external provider authentication. The collab-web command only supplies OMP's ignored HTML export asset required by the source loader; it is a build prerequisite, not a product change.
