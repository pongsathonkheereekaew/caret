# Caret Mac task extension

This package contains the tracked VS Code/Caret extension boundary for the Mac
task surface. It reads the private `host.json` descriptor, sends authenticated
requests to the Caret host, and projects the host's durable event pages into a
Codex-inspired task view.

The extension does not start OMP, hold provider credentials, or execute a
webview-supplied command. OMP remains owned by the host. Native file, diff,
terminal, and settings actions stay on the extension side of the webview
boundary. Commands keep their original IDs across reconnect and an unknown
outcome is shown for explicit reconciliation instead of being replayed.

Run the package checks from the repo root:

```sh
bun test apps/macos/test
bunx tsc --noEmit -p apps/macos/tsconfig.json
```

The actual extension build supplies the VS Code SDK and bundles `src/extension.ts`;
the control repository can still typecheck the pure API, reducer, message, and
webview modules without VS Code installed.
