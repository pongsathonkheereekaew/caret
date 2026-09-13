# OMP RPC probe (2026-09-12)

This directory records a provider-free probe of `/Users/pond/.local/bin/omp`
(`omp v18.1.18`) against the checked-out source at `/tmp/omp-source.nmo5hX`.
The probe is intentionally a control-plane subset; it does not claim complete
feature coverage.

Root reran both modes from this retained script. Each summary records the binary
version and SHA256 plus the source reference; this is version matching, not a
reproducible-build assertion that the installed binary was built from that SHA.
The script rejects a different version and asserts v2 selection, expected isolated
tool sets, queue-mode readback, invalid-input rejection, bash output and clean exit.
`source-inventory.json` separately records static registry names/source hashes;
its 28 built-ins, 3 hidden names and 42 RPC commands are not the effective tool set
or a measure of full product coverage.

## Reproduce

```sh
python3 /Users/pond/caret/source/docs/maintenance/evidence/omp-rpc-2026-09-12/rpc_probe.py rpc > /Users/pond/caret/source/docs/maintenance/evidence/omp-rpc-2026-09-12/rpc-run.json
python3 /Users/pond/caret/source/docs/maintenance/evidence/omp-rpc-2026-09-12/rpc_probe.py rpc-ui > /Users/pond/caret/source/docs/maintenance/evidence/omp-rpc-2026-09-12/rpc-ui-run.json
```

The script creates an isolated `/tmp/caret-omp-rpc-*` directory, writes one
`auth: none` model pointing at `127.0.0.1:9`, uses `PI_CODING_AGENT_DIR` there,
passes no credentials, and never sends `prompt` or `login`. It closes stdin and
requires OMP to exit within three seconds after the commands complete. Raw
frames/stderr and summaries are written beside this file.

## Runtime results

Both `rpc` and `rpc-ui` runs passed with exit code 0 (34 frames each):

- ready advertises protocol v1, supported versions `[1, 2]`, a 1 MiB physical
  frame limit, and a 64 MiB reassembly limit;
- protocol v2 negotiation succeeds;
- `get_state`, `get_available_commands`, `get_available_models`,
  `get_messages`, `get_messages_page`, `get_session_stats`, todos, queue modes,
  compaction/retry toggles, host tools, host URI schemes, session naming,
  branch/last-assistant queries, and login-provider listing respond;
- direct `bash` executes `printf OMP_RPC_BASH_OK` in the isolated directory;
- malformed JSON produces a recoverable `command: "parse"` error, and an
  unknown command produces an id-less error; a subsequent `get_state` still
  succeeds;
- enabling fast mode correctly fails for the custom model with
  `Fast mode is unavailable for the current model.`

Plain `rpc` exposes 11 built-in tools in `get_state.dumpTools`:
`read`, `bash`, `edit`, `eval`, `glob`, `grep`, `task`, `hub`, `todo`,
`web_search`, `write`. `rpc-ui` exposes the same set plus `ask` (12 tools).
The difference is expected: source `main.ts` sets `sessionOptions.hasUI` for
`rpc-ui` and passes `setToolUIContext` to `runRpcMode`; plain `rpc` does not.

## Source tests

The targeted Bun tests could not collect because this checkout has no installed
workspace links (`@oh-my-pi/pi-utils` is missing):

```text
bun test packages/coding-agent/test/rpc-frame.test.ts \
  packages/coding-agent/test/rpc-input-frame.test.ts
# 0 pass, 2 fail: Cannot find module '@oh-my-pi/pi-utils'
```

The Python RPC protocol/client tests pass under the available Python 3.11 using
stdlib `unittest` (pytest is not installed):

```text
PYTHONPATH=python/omp-rpc/src python3.11 -m unittest \
  python/omp-rpc/tests/test_protocol.py python/omp-rpc/tests/test_client.py
# Ran 54 tests ... OK
```

The full Python discovery reaches 67 passing tests, then cannot import
`test_user_group.py` because `pytest` is absent. No dependencies were installed.

## Coverage gaps

No provider/model turn, streaming events, v2 chunk reassembly, extension UI
response round trips, host-tool invocation, host-URI read/write, MCP, browser,
computer, task/subagent, compaction, retry, worktree/session switching, or
durable resume was exercised. These require dedicated fixtures or provider-free
mock servers before treating OMP as fully covered by Caret.
