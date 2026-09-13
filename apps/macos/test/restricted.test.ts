import { expect, test } from "bun:test";
import type * as vscode from "vscode";
import { activateRestrictedWorkspace } from "../src/restricted.ts";

test("restricted shell exposes only trust management and disposes before activating execution", async () => {
  const commands = new Map<string, () => unknown>();
  const executed: string[] = [];
  let grant = () => {};
  let disposed = 0;
  let resumed = 0;
  const webview = { options: {}, html: "" };
  const panel = { webview, reveal() {}, onDidDispose: () => ({ dispose() {} }), dispose() { disposed++; } };
  const api = {
    ViewColumn: { One: 1 },
    window: {
      createWebviewPanel: () => panel,
      registerWebviewViewProvider: () => ({ dispose() { disposed++; } }),
    },
    workspace: {
      getConfiguration: () => ({ get: () => true }),
      onDidGrantWorkspaceTrust: (callback: () => void) => { grant = callback; return { dispose() { disposed++; } }; },
    },
    commands: {
      registerCommand: (id: string, callback: () => unknown) => {
        commands.set(id, callback); return { dispose() { commands.delete(id); } };
      },
      executeCommand: (id: string) => { executed.push(id); },
    },
  };
  const subscriptions: vscode.Disposable[] = [];
  const context = { subscriptions, extension: { packageJSON: { contributes: { commands:
    ["caret.newTask", "caret.openTerminal", "caret.pairDevice", "caret.openComposer"].map(command => ({ command })),
  } } } };
  activateRestrictedWorkspace(api as unknown as typeof vscode, context as unknown as vscode.ExtensionContext, () => {
    expect(commands.size).toBe(0);
    expect(disposed).toBe(3);
    resumed++;
  });
  expect(webview.options).toEqual({ enableScripts: false, enableCommandUris: ["workbench.trust.manage"] });
  expect(webview.html).toContain("Restricted Mode");
  for (const id of ["caret.newTask", "caret.openTerminal", "caret.pairDevice"]) await commands.get(id)!();
  expect(executed).toEqual(Array(3).fill("workbench.trust.manage"));
  grant();
  expect(resumed).toBe(1);
  subscriptions.forEach(item => item.dispose());
  expect(disposed).toBe(3);
});
