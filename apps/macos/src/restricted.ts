import type * as vscode from "vscode";

/** A declarative shell only: no host, editor bridge, terminal, or task is created. */
export function activateRestrictedWorkspace(
  api: typeof vscode,
  context: vscode.ExtensionContext,
  resume: () => void,
): void {
  const registrations: vscode.Disposable[] = [];
  let panel: vscode.WebviewPanel | undefined;
  let disposed = false;
  const showTrust = () => api.commands.executeCommand("workbench.trust.manage");
  const render = (webview: vscode.Webview) => {
    webview.options = { enableScripts: false, enableCommandUris: ["workbench.trust.manage"] };
    webview.html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:32px;max-width:44rem}a{color:var(--vscode-textLink-foreground)}a:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:4px}</style></head><body><h1>Caret</h1><p>This folder is in Restricted Mode. You can browse its files. Trust the folder to start tasks or connect to the Caret host.</p><p><a href="command:workbench.trust.manage">Manage workspace trust</a></p></body></html>`;
  };
  const open = () => {
    if (panel) { panel.reveal(); return; }
    panel = api.window.createWebviewPanel("caretRestricted", "Caret", api.ViewColumn.One, {});
    render(panel.webview);
    registrations.push(panel.onDidDispose(() => { panel = undefined; }));
  };
  // The dock is the only Caret view left; the retired full-page shell view used
  // to be registered here instead, which left this one with no provider and let
  // the dock open as a "no data provider" error.
  registrations.push(api.window.registerWebviewViewProvider("caretComposerDock", {
    resolveWebviewView(view) { render(view.webview); },
  }));
  const commands = context.extension.packageJSON.contributes.commands as Array<{ command: string }>;
  for (const { command } of commands) {
    registrations.push(api.commands.registerCommand(command,
      command === "caret.openComposer" ? open : showTrust));
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const registration of registrations.splice(0)) registration.dispose();
    panel?.dispose();
    panel = undefined;
  };
  registrations.push(api.workspace.onDidGrantWorkspaceTrust(() => {
    if (disposed) return;
    dispose();
    resume();
  }));
  context.subscriptions.push({ dispose });
  if (api.workspace.getConfiguration("caret").get("openTasksOnStartup", true)) open();
}
