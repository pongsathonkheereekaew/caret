/**
 * Runtime smoke for the Synara-shaped Agent Window panels.
 *
 * The default run exercises the packaged Electron shell. `--browser` is a
 * renderer-only fallback for CI environments without a packaged Cedia app;
 * native panel checks are reported as unsupported there rather than faked.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { startHostServer } from "../apps/host/src/server.ts";
import { createAgentFilesService } from "../apps/macos/src/agent-window-files.ts";
import { createAgentHostGateway, createAgentWindowHandler } from "../apps/macos/src/agent-window-main.ts";

type AnyRecord = Record<string, any>;
type PanelStatus = {
  clicked: boolean;
  ok: boolean;
  detail?: unknown;
  error?: string;
  screenshot?: string;
};

const root = resolve(import.meta.dir, "..");
const native = !process.argv.includes("--browser");
const { chromium, _electron } = createRequire(join(root, "desktop/package.json"))("playwright");
const scratch = await mkdtemp(join(tmpdir(), "cedia-agent-panels-"));
const projectPath = join(scratch, "project");
await mkdir(join(projectPath, "src"), { recursive: true });
await writeFile(join(projectPath, "README.md"), "Panel fixture workspace\n");
await writeFile(join(projectPath, "notes.txt"), "Base panel text\n");
await writeFile(join(projectPath, "src", "main.ts"), "export const panelFixture = true;\n");
// Make the Environment panel exercise a real repository diff instead of an
// empty-directory placeholder. The post-commit edit is the content the Files
// panel and the readback assertions below expect.
execFileSync("git", ["init", "-q"], { cwd: projectPath, stdio: "ignore" });
execFileSync("git", ["config", "user.name", "Cedia Panel Fixture"], { cwd: projectPath, stdio: "ignore" });
execFileSync("git", ["config", "user.email", "cedia-panel-fixture@example.invalid"], { cwd: projectPath, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: projectPath, stdio: "ignore" });
execFileSync("git", ["commit", "-qm", "fixture baseline"], { cwd: projectPath, stdio: "ignore" });
execFileSync("git", ["branch", "-M", "main"], { cwd: projectPath, stdio: "ignore" });
await writeFile(join(projectPath, "notes.txt"), "Original panel text\n");

const stateDir = join(scratch, "host");
const host = await startHostServer({
  stateDir,
  ompExecutable: join(root, "apps/macos/test/fixtures/agent-window-omp"),
  ompEnv: { CEDIA_NODE: process.execPath },
});
const project = host.host.store.createProject({ path: projectPath, name: "Panel fixture workspace" });
const session = host.host.createSession(project.id, "Panel fixture task");

// The browser panel must load an actual local page so the native WebContentsView
// path is exercised without relying on the network or a provider.
const browserFixture = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname === "/favicon.ico") return new Response(null, { status: 204 });
    if (pathname !== "/cedia-panel-fixture") return new Response("Not found", { status: 404 });
    const marker = url.searchParams.get("marker")?.replace(/[^a-z0-9_-]/gi, "") || "blank";
    return new Response(
      `<!doctype html><html><head><title>Cedia panel browser fixture ${marker}</title></head><body><main data-cedia-browser-fixture="true">Cedia browser fixture ${marker}</main><a id="fixture-link" href="?marker=linked">Follow fixture link</a></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  },
});
const browserFixtureUrl = new URL("cedia-panel-fixture", browserFixture.url).toString();

const gateway = createAgentHostGateway({ appRoot: root, parentPid: process.pid, stateDir });
const ideTargets: unknown[] = [];
const fixtureFiles = createAgentFilesService();
const fixturePanelEvent = { sender: { send: () => {}, isDestroyed: () => false } };
const handler = createAgentWindowHandler({
  ...gateway,
  authorize: () => true,
  pickFolder: async () => projectPath,
  openIde: async (input) => { ideTargets.push(input); },
  openExternal: async () => { throw new Error("External links are disabled in fixture tests"); },
  version: "panel-fixture",
  panel: async (_event, surface, method, input) => {
    if (surface === "files") return fixtureFiles.handle(fixturePanelEvent, method, input);
    throw new Error(`Native ${surface} panel unavailable in renderer-only tests`);
  },
});

const output = join(root, process.argv.includes("--hover-only") ? "dist/agent-file-hover-smoke" : "dist/agent-window-panels-smoke");
await mkdir(output, { recursive: true });
const assets = join(root, "dist/agent-window");
const appServer = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    const assetPath = resolve(assets, `.${decodeURIComponent(url.pathname)}`);
    if (assetPath !== assets && !assetPath.startsWith(`${assets}/`)) return new Response("Not found", { status: 404 });
    const file = Bun.file(assetPath === assets ? join(assets, "index.html") : assetPath);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(join(assets, "index.html")));
  },
});

if (native) {
  // Keep the personal launcher behaviour used by the normal smoke: an ad-hoc
  // re-signed app must not inherit a stale Chromium Safe Storage item.
  try { execFileSync("security", ["delete-generic-password", "-s", "Cedia Safe Storage"], { stdio: "ignore" }); } catch {}
}

const launchNative = () => _electron.launch({
  executablePath: join(root, `VSCode-darwin-${process.arch}/Cedia.app/Contents/MacOS/Cedia`),
  args: [
    "--user-data-dir", join(scratch, "profile"),
    "--password-store=basic",
    "--use-inmemory-secretstorage",
    "--skip-welcome",
    "--skip-release-notes",
  ],
  env: {
    ...process.env,
    CEDIA_STATE_DIR: stateDir,
    CEDIA_HOST_NODE: process.env.CEDIA_HOST_NODE ?? "/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin/node",
  },
  timeout: 45_000,
});
let browser = native ? await launchNative() : await chromium.launch({ headless: true, channel: "chromium" });
let page = native
  ? await browser.firstWindow()
  : await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });

const errors: string[] = [];
const panelResults: Record<string, PanelStatus> = {};
const bridgeRequests: unknown[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
page.on("console", (message: { type(): string; text(): string }) => {
  if (message.type() === "error") errors.push(message.text());
});

if (!native) {
  await page.exposeBinding("__cediaFixtureInvoke", async (_source: unknown, channel: string, input: unknown) => {
    if (channel !== "vscode:cediaAgent") throw new Error(`Unexpected fixture IPC channel: ${channel}`);
    bridgeRequests.push(input);
    return handler({}, input);
  });
  await page.addInitScript(() => {
    const target = window as unknown as {
      __cediaFixtureInvoke(channel: string, input: unknown): Promise<unknown>;
      vscode: unknown;
    };
    target.vscode = {
      context: { resolveConfiguration: async () => ({ windowId: 1, isSessionsWindow: true }) },
      process: { platform: "darwin", env: {} },
      ipcRenderer: {
        invoke: (channel: string, input: unknown) => target.__cediaFixtureInvoke(channel, input),
        send: () => {},
        on: () => {},
        once: () => {},
        removeListener: () => {},
      },
    };
  });
}

const recordError = (error: unknown): string => error instanceof Error ? error.message : String(error);
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const waitFor = async <T>(read: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 30_000): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let latest: T;
  do {
    latest = await read();
    if (predicate(latest)) return latest;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  } while (Date.now() < deadline);
  return latest!;
};
const screenshot = async (name: string): Promise<string> => {
  const path = join(output, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
};

async function rawPanelInvoke(surface: string, method: string, input: AnyRecord): Promise<any> {
  assert(native, `${surface}.${method} needs the packaged Electron shell`);
  return await page.evaluate(async ({ surface, method, input }: { surface: string; method: string; input: AnyRecord }) => {
    const bridge = (window as any).vscode?.ipcRenderer;
    if (!bridge?.invoke) throw new Error("Agent Window preload bridge is unavailable");
    return await bridge.invoke("vscode:cediaAgent", { kind: "panel", surface, method, input });
  }, { surface, method, input });
}

async function terminalSmoke(): Promise<Record<string, unknown>> {
  assert(native, "Terminal PTY requires the packaged Electron shell");
  const terminalId = "panel-smoke-terminal";
  const marker = "cedia-panel-terminal-ok";
  const result = await page.evaluate(async ({ threadId, cwd, terminalId, marker }: { threadId: string; cwd: string; terminalId: string; marker: string }) => {
    const bridge = (window as any).vscode?.ipcRenderer;
    if (!bridge?.invoke || typeof bridge.on !== "function") throw new Error("Terminal preload events are unavailable");
    let output = "";
    const onEvent = (_event: unknown, payload: any) => {
      const event = payload?.event ?? payload;
      if (event?.type === "output" && event.threadId === threadId && event.terminalId === terminalId) output += String(event.data ?? "");
    };
    bridge.on("vscode:cediaAgentTerminal", onEvent);
    try {
      await bridge.invoke("vscode:cediaAgent", {
        kind: "panel", surface: "terminal", method: "open",
        input: { threadId, terminalId, cwd, cols: 100, rows: 30, streamOutput: true },
      });
      await bridge.invoke("vscode:cediaAgent", {
        kind: "panel", surface: "terminal", method: "write",
        input: { threadId, terminalId, data: `printf '${marker}\\n'\n` },
      });
      const deadline = Date.now() + 15_000;
      while (!output.split(/\r?\n/).some(line => line.trim() === marker) && Date.now() < deadline) await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      return { output, found: output.split(/\r?\n/).some(line => line.trim() === marker) };
    } finally {
      bridge.removeListener?.("vscode:cediaAgentTerminal", onEvent);
      await bridge.invoke("vscode:cediaAgent", {
        kind: "panel", surface: "terminal", method: "close", input: { threadId, terminalId },
      }).catch(() => undefined);
    }
  }, { threadId: session.id, cwd: projectPath, terminalId, marker });
  assert(result.found, `Terminal PTY did not emit '${marker}': ${JSON.stringify(result.output)}`);
  return result;
}

async function filesSmoke(): Promise<Record<string, unknown>> {
  assert(native, "Files native bridge requires the packaged Electron shell");
  const rootListing = await rawPanelInvoke("files", "projects.listDirectories", { cwd: projectPath, includeFiles: true });
  const names = (rootListing.entries ?? []).map((entry: AnyRecord) => entry.name);
  assert(names.includes("notes.txt") && names.includes("src"), "Files panel did not list the fixture tree");
  const before = await rawPanelInvoke("files", "projects.readFile", { cwd: projectPath, relativePath: "notes.txt" });
  assert(before.contents === "Original panel text\n", "Files panel read returned the wrong fixture content");
  const nextContents = "Edited from panel smoke\n";
  const saved = await rawPanelInvoke("files", "projects.writeFile", {
    cwd: projectPath,
    relativePath: "notes.txt",
    contents: nextContents,
    expectedVersion: before.version,
    encoding: before.encoding,
    lineEnding: before.lineEnding,
  });
  const after = await rawPanelInvoke("files", "projects.readFile", { cwd: projectPath, relativePath: "notes.txt" });
  assert(after.contents === nextContents && saved.version === after.version, "Files panel write did not preserve the returned version");
  const search = await rawPanelInvoke("files", "projects.searchContent", { cwd: projectPath, query: "Edited from panel", limit: 10 });
  assert(search.matches?.some((match: AnyRecord) => match.path === "notes.txt"), "Files panel content search missed the saved text");
  return { listed: names, beforeVersion: before.version, afterVersion: after.version, searchMatches: search.matches };
}

async function browserSmoke(): Promise<Record<string, unknown>> {
  assert(native, "Browser WebContentsView requires the packaged Electron shell");
  const nav = await openLauncher();
  await nav.getByRole("button", { name: "Open Browser", exact: true }).click();
  await page.getByPlaceholder("Search or enter a URL", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  const markerOneUrl = new URL("cedia-panel-fixture?marker=one", browserFixture.url).toString();
  const markerTwoUrl = new URL("cedia-panel-fixture?marker=two", browserFixture.url).toString();
  const state = await rawPanelInvoke("browser", "open", { threadId: session.id });
  assert(state?.tabs?.length > 0, "Browser panel did not create a native tab");
  const tabId = state.activeTabId ?? state.tabs[0].id;
  const address = page.locator('input[placeholder="Search or enter a URL"]');
  await address.fill(markerOneUrl);
  await address.press("Enter");
  const loaded = await waitFor(
    () => rawPanelInvoke("browser", "getState", { threadId: session.id }),
    (value) => value?.tabs?.some((tab: AnyRecord) => tab.id === tabId && tab.lastCommittedUrl?.startsWith(markerOneUrl)),
    20_000,
  );
  const active = loaded.tabs.find((tab: AnyRecord) => tab.id === tabId);
  assert(active?.lastCommittedUrl?.startsWith(markerOneUrl), "Browser WebContentsView did not load the first local fixture");
  await page.locator('input[placeholder="Search or enter a URL"]').waitFor({ state: "visible" });
  await page.waitForFunction((url: string) => (document.querySelector('input[placeholder="Search or enter a URL"]') as HTMLInputElement | null)?.value === url, markerOneUrl, { timeout: 15_000 });
  const capture = await page.evaluate(async ({ threadId, tabId }: { threadId: string; tabId: string }) => {
    const bridge = (window as any).vscode?.ipcRenderer;
    const value = await bridge.invoke("vscode:cediaAgent", { kind: "panel", surface: "browser", method: "captureScreenshot", input: { threadId, tabId } });
    const bytes = value?.bytes instanceof Uint8Array ? Array.from(value.bytes) : Array.isArray(value?.bytes) ? value.bytes : null;
    return { name: value?.name, mimeType: value?.mimeType, sizeBytes: value?.sizeBytes, bytes };
  }, { threadId: session.id, tabId });
  assert(capture.sizeBytes > 0, "Browser WebContentsView did not produce the first screenshot");
  if (capture.bytes && capture.bytes.length > 0) {
    await writeFile(join(output, "browser-webcontents-view-one.png"), Buffer.from(capture.bytes));
  }
  await browser.evaluate(async ({ webContents }: any, expectedUrl: string) => {
    const guest = webContents.getAllWebContents().find((contents: any) => contents.getURL() === expectedUrl);
    if (!guest) throw new Error("Fixture browser page is missing");
    (globalThis as any).__cediaBrowserNavigationProbe = [];
    for (const event of ["will-navigate", "will-redirect", "did-navigate", "did-fail-load"]) {
      guest.on(event, (...args: any[]) => (globalThis as any).__cediaBrowserNavigationProbe.push({ event, args: args.map(arg => typeof arg === "object" && arg ? { keys: Object.keys(arg), url: arg.url, isMainFrame: arg.isMainFrame, defaultPrevented: arg.defaultPrevented } : arg) }));
    }
    await guest.executeJavaScript('document.getElementById("fixture-link").click()', true);
  }, markerOneUrl);
  const followed = await waitFor(
    () => rawPanelInvoke("browser", "getState", { threadId: session.id }),
    (value) => value?.tabs?.some((tab: AnyRecord) => tab.id === tabId && tab.lastCommittedUrl?.includes("marker=linked") && !tab.isLoading && tab.canGoBack),
    15_000,
  );
  assert(followed?.tabs?.some((tab: AnyRecord) => tab.id === tabId && tab.lastCommittedUrl?.includes("marker=linked")), `Clicking a link inside the page was blocked: ${JSON.stringify(await browser.evaluate(() => (globalThis as any).__cediaBrowserNavigationProbe))} state=${JSON.stringify(followed)}`);
  await rawPanelInvoke("browser", "goBack", { threadId: session.id, tabId });
  const returned = await waitFor(() => rawPanelInvoke("browser", "getState", { threadId: session.id }), (value) => value?.tabs?.some((tab: AnyRecord) => tab.id === tabId && tab.lastCommittedUrl === markerOneUrl && !tab.isLoading), 15_000);
  assert(returned?.tabs?.some((tab: AnyRecord) => tab.id === tabId && tab.lastCommittedUrl === markerOneUrl), `Back navigation failed: ${JSON.stringify(returned)} probe=${JSON.stringify(await browser.evaluate(({ webContents }: any) => ({ events: (globalThis as any).__cediaBrowserNavigationProbe, histories: webContents.getAllWebContents().filter((wc: any) => wc.getURL().includes("cedia-panel-fixture")).map((wc: any) => ({url:wc.getURL(), back:wc.navigationHistory?.canGoBack(), entries:wc.navigationHistory?.getAllEntries(), index:wc.navigationHistory?.getActiveIndex()})) })))}`);
  // Native macOS restores the address field's DOM focus when a click returns
  // from the guest. That must not reopen suggestions over the tab controls.
  await address.evaluate((input: HTMLInputElement) => { input.blur(); input.focus(); });
  assert(await page.getByRole("button", { name: `Open ${markerOneUrl} ${markerOneUrl}`, exact: true }).count() === 0, "Restored address focus reopened suggestions over Browser tabs");
  await page.getByRole("button", { name: "New tab", exact: true }).last().click();
  const second = await waitFor(() => rawPanelInvoke("browser", "getState", { threadId: session.id }), value => value.tabs.length === state.tabs.length + 1, 10_000);
  await address.fill(markerTwoUrl);
  await address.press("Enter");
  const secondTabId = second.activeTabId ?? second.tabs.at(-1)?.id;
  assert(typeof secondTabId === "string" && secondTabId !== tabId, "Browser panel did not create a second tab");
  const secondLoaded = await waitFor(
    () => rawPanelInvoke("browser", "getState", { threadId: session.id }),
    (value) => value?.tabs?.some((tab: AnyRecord) => tab.id === secondTabId && tab.lastCommittedUrl?.startsWith(markerTwoUrl)),
    20_000,
  );
  const secondActive = secondLoaded.tabs.find((tab: AnyRecord) => tab.id === secondTabId);
  assert(secondActive?.lastCommittedUrl?.startsWith(markerTwoUrl), "Browser WebContentsView did not load the second local fixture");
  await page.waitForFunction((url: string) => (document.querySelector('input[placeholder="Search or enter a URL"]') as HTMLInputElement | null)?.value === url, markerTwoUrl, { timeout: 15_000 });
  const secondCapture = await page.evaluate(async ({ threadId, tabId }: { threadId: string; tabId: string }) => {
    const bridge = (window as any).vscode?.ipcRenderer;
    const value = await bridge.invoke("vscode:cediaAgent", { kind: "panel", surface: "browser", method: "captureScreenshot", input: { threadId, tabId } });
    const bytes = value?.bytes instanceof Uint8Array ? Array.from(value.bytes) : Array.isArray(value?.bytes) ? value.bytes : null;
    return { sizeBytes: value?.sizeBytes, bytes };
  }, { threadId: session.id, tabId: secondTabId });
  assert(secondCapture.sizeBytes > 0, "Browser WebContentsView did not produce the second screenshot");
  if (secondCapture.bytes && secondCapture.bytes.length > 0) {
    await writeFile(join(output, "browser-webcontents-view-two.png"), Buffer.from(secondCapture.bytes));
  }
  const firstBytes = capture.bytes ?? [];
  const secondBytes = secondCapture.bytes ?? [];
  assert(firstBytes.length !== secondBytes.length || firstBytes.some((value: number, index: number) => value !== secondBytes[index]), "Switching browser tabs produced identical rendered content");
  await rawPanelInvoke("browser", "selectTab", { threadId: session.id, tabId });
  await page.waitForFunction((url: string) => (document.querySelector('input[placeholder="Search or enter a URL"]') as HTMLInputElement | null)?.value === url, markerOneUrl, { timeout: 15_000 });
  const attachedUrls = await browser.evaluate(({ BrowserWindow }: any) => BrowserWindow.getAllWindows().flatMap((window: any) =>
    window.contentView.children.flatMap((view: any) => view.webContents ? [view.webContents.getURL()] : [])));
  assert(attachedUrls.includes(markerOneUrl) && !attachedUrls.includes(markerTwoUrl), "The selected browser tab was not the attached native view");
  await address.focus();
  await page.keyboard.press("Meta+-");
  await waitFor(() => page.evaluate(() => window.desktopBridge?.getZoomFactor?.()), value => typeof value === "number" && value < 1, 5_000);
  const zoomedBrowserBounds = await waitFor(async () => {
    const dom = await page.locator('[data-browser-viewport="true"]').boundingBox();
    const view = await browser.evaluate(({ BrowserWindow }: any) => {
      for (const owner of BrowserWindow.getAllWindows()) {
        const guest = owner.contentView.children.find((child: any) => child.webContents?.getURL().includes("cedia-panel-fixture"));
        if (guest) return { bounds: guest.getBounds(), factor: owner.webContents.getZoomFactor() };
      }
      return null;
    });
    return { dom, view };
  }, value => Boolean(value.dom && value.view && ["x", "y", "width", "height"].every(key => Math.abs(value.dom[key] * value.view.factor - value.view.bounds[key]) <= 2)), 10_000);
  assert(zoomedBrowserBounds.view, "Zoomed Browser view did not align with its renderer viewport");
  await page.keyboard.press("Meta+0");
  await waitFor(() => page.evaluate(() => window.desktopBridge?.getZoomFactor?.()), value => value === 1, 5_000);
  await screenshot("browser-switched-back");
  await page.getByRole("button", { name: "Close tab", exact: true }).last().click();
  const closedTab = await waitFor(() => rawPanelInvoke("browser", "getState", { threadId: session.id }), value => !value.tabs.some((tab: AnyRecord) => tab.id === secondTabId), 10_000);
  assert(closedTab.tabs.length === state.tabs.length, "Closing a browser tab did not remove it");
  await page.getByRole("button", { name: "Close tab", exact: true }).click();
  const allClosed = await waitFor(() => rawPanelInvoke("browser", "getState", { threadId: session.id }), value => value.tabs.length === 0 && !value.open, 10_000);
  assert(allClosed.activeTabId === null, "Closing the final tab did not close the Browser");
  await collapseDock();
  return { addedTabViaUI: true, closedTabViaUI: true, followedLink: true, zoomedBrowserBounds, attachedUrls, state: active, secondTab: secondActive, screenshotBytes: [capture.sizeBytes, secondCapture.sizeBytes], fixtureUrls: [markerOneUrl, markerTwoUrl] };
}

async function openLauncher(): Promise<any> {
  const nav = page.getByRole("navigation", { name: "Open a panel", exact: true });
  const toggle = page.getByRole("button", { name: "Toggle right sidebar", exact: true });
  if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
  const paneClosers = page.locator("[data-right-dock-content] > div:first-child").getByRole("button", { name: /^Close / });
  for (let count = 0; count < 10 && await paneClosers.count() > 0; count++) await paneClosers.first().click();
  await nav.waitFor({ state: "visible", timeout: 15_000 });
  return nav;
}

async function collapseDock(): Promise<void> {
  const toggle = page.getByRole("button", { name: "Toggle right sidebar", exact: true });
  if (await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Toggle right sidebar"]')?.getAttribute("aria-pressed") === "false");
}

type LayoutBox = { x: number; y: number; width: number; height: number };

function boxesOverlap(left: LayoutBox, right: LayoutBox): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

async function visibleElementCount(locator: any): Promise<number> {
  return await locator.evaluateAll((nodes: Element[]) => nodes.filter((node: Element) => {
    const element = node as HTMLElement;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
  }).length);
}

async function headerActionsSmoke(): Promise<Record<string, unknown>> {
  const ideButton = page.getByRole("button", { name: "Open in IDE", exact: true });
  await ideButton.waitFor({ state: "visible", timeout: 15_000 });
  if (native) {
    assert(!(await ideButton.isDisabled()), "IDE header action is visible but disabled");
    const opened = browser.waitForEvent("window", { predicate: (candidate: any) => candidate !== page, timeout: 30_000 });
    await ideButton.click();
    const ide = await opened;
    await ide.waitForURL(/workbench/, { timeout: 30_000 });
    await ide.locator(".monaco-workbench").waitFor({ timeout: 30_000 });
    const config = await ide.evaluate(async () => (window as any).vscode.context.resolveConfiguration());
    assert(typeof config.workspace?.uri?.path === "string" && await realpath(config.workspace.uri.path) === await realpath(projectPath), `IDE opened the wrong workspace: ${JSON.stringify(config.workspace)} expected ${projectPath}`);
    ideTargets.push({ cwd: config.workspace.uri.path });
    await ide.bringToFront();
    await ide.keyboard.press("Meta+Shift+A");
    await page.waitForFunction(() => document.hasFocus(), { timeout: 20_000 });
    assert(browser.windows().length === 2, "Returning to Agent created a duplicate window");
  }
  const moreButton = page.getByRole("button", { name: "More actions", exact: true });
  await moreButton.waitFor({ state: "visible", timeout: 15_000 });
  await moreButton.click();
  const openInIdeMenuItem = page.getByRole("menuitem", { name: "Open in IDE", exact: true });
  await openInIdeMenuItem.waitFor({ state: "visible", timeout: 10_000 });
  await page.keyboard.press("Escape");
  return {
    ideButtonVisible: true,
    ideHandoff: native ? (ideTargets.at(-1) ?? null) : "native shell skipped in --browser mode",
    overflowButtonVisible: true,
    overflowOpenInIdeVisible: true,
  };
}

async function environmentSmoke(): Promise<Record<string, unknown>> {
  const toggle = page.getByRole("button", { name: "Toggle environment panel", exact: true });
  await toggle.waitFor({ state: "visible", timeout: 15_000 });
  if (await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  const panel = page.locator("[data-environment-panel-variant]").first();
  await waitFor(
    () => panel.getAttribute("aria-hidden"),
    (value) => value === "true",
    10_000,
  );
  const closedRightToggleCount = await visibleElementCount(
    page.getByRole("button", { name: "Toggle right sidebar", exact: true }),
  );
  assert(closedRightToggleCount === 1, `Expected one visible right-sidebar toggle with Environment closed, found ${closedRightToggleCount}`);
  await toggle.click();
  await waitFor(
    () => panel.getAttribute("aria-hidden"),
    (value) => value === "false",
    10_000,
  );

  const changes = page.getByRole("button", { name: /^Changes(?:\s|$)/ }).first();
  await changes.waitFor({ state: "visible", timeout: 15_000 });
  const changesText = await waitFor<string>(
    () => changes.innerText(),
    (value) => /\+\s*\d/.test(value) && /(?:-|−)\s*\d/.test(value),
    20_000,
  );
  assert(/\+\s*\d/.test(changesText) && /(?:-|−)\s*\d/.test(changesText), `Environment Changes row did not show the real Git diff: ${changesText}`);

  const local = panel.getByRole("button", { name: "Local", exact: true });
  const branch = panel.locator('[data-slot="combobox-trigger"]').filter({ hasText: /^main$/ });
  const compareBranch = page.getByRole("button", { name: "Compare branch", exact: true });
  await local.waitFor({ state: "visible", timeout: 15_000 });
  await branch.waitFor({ state: "visible", timeout: 15_000 });
  await compareBranch.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Subagents", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Sources", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });

  const card = page.locator('[data-environment-panel-variant] > div').first();
  assert(await panel.getAttribute("data-environment-panel-motion") === "menu-dropdown", "Environment has the wrong transition");
  const motion = await card.evaluate((element: HTMLElement) => ({ duration: getComputedStyle(element).transitionDuration, origin: getComputedStyle(element).transformOrigin, transition: getComputedStyle(element).transitionProperty }));
  assert(motion.duration.includes("0.25s") && motion.transition.includes("transform"), `Environment dropdown timing is missing: ${JSON.stringify(motion)}`);
  const cardBox = await card.boundingBox();
  const toggleBox = await toggle.boundingBox();
  assert(cardBox && toggleBox, "Environment panel or toggle has no layout box while open");
  assert(!boxesOverlap(cardBox, toggleBox), "Environment panel overlaps its header toggle while open");
  const openRightToggleCount = await visibleElementCount(
    page.getByRole("button", { name: "Toggle right sidebar", exact: true }),
  );
  assert(openRightToggleCount === 1, `Expected one visible right-sidebar toggle with Environment open, found ${openRightToggleCount}`);

  await toggle.click();
  await waitFor(
    () => panel.getAttribute("aria-hidden"),
    (value) => value === "true",
    10_000,
  );
  assert(await toggle.getAttribute("aria-pressed") === "false", "Environment toggle did not close the panel");
  return {
    closed: true,
    open: true,
    changesText,
    branch: "main",
    local: true,
    compareBranch: true,
    subagents: true,
    sources: true,
    closedRightToggleCount,
    openRightToggleCount,
    motion,
    openPanelBox: cardBox,
    environmentToggleBox: toggleBox,
    openOverlap: false,
  };
}

/**
 * Electron can leave a WebContentsView (or a PTY-backed panel) alive while
 * Playwright waits for Browser.close(). Give normal shutdown a short grace
 * period, then terminate only this smoke's child application process. This is
 * deliberately scoped to the process returned by ElectronApplication.process;
 * it never searches for or kills unrelated host/browser processes.
 */
async function closeBrowserBounded(app: any): Promise<void> {
  let closed = false;
  const closePromise = Promise.resolve()
    .then(() => app.close())
    .then(() => { closed = true; }, () => undefined);
  await Promise.race([
    closePromise,
    new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 5_000)),
  ]);
  if (closed) return;

  try {
    const child = typeof app.process === "function" ? app.process() : undefined;
    if (child && !child.killed) child.kill("SIGTERM");
  } catch {
    // The app may have exited between the timeout and process() lookup.
  }
  await Promise.race([
    closePromise,
    new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 2_000)),
  ]);
}

async function verifyDesktopZoom(): Promise<Record<string, unknown>> {
  if (!native) return { skipped: "native zoom requires Electron" };
  const factor = () => page.evaluate(() => window.desktopBridge?.getZoomFactor?.());
  const geometry = () => browser.evaluate(({ BrowserWindow }: any) => {
    const owner = BrowserWindow.getAllWindows().find((window: any) => window.webContents.getURL().includes("/cedia/agent/"));
    if (!owner) throw new Error("Agent window not found");
    return { factor: owner.webContents.getZoomFactor(), traffic: owner.getWindowButtonPosition() };
  });
  const checkGeometry = async () => {
    const value = await geometry();
    assert(value.traffic && Math.abs(value.traffic.y + 7 - 23 * value.factor) <= 1, `Traffic lights are not centered on the zoomed header: ${JSON.stringify(value)}`);
    assert(Math.abs((await factor()) - value.factor) < 0.001, "Renderer and native zoom factors diverged");
    return value;
  };
  await page.keyboard.press("Meta+0");
  await waitFor(factor, value => value === 1, 5_000);
  const baseline = await checkGeometry();
  await page.keyboard.press("Meta+-");
  await waitFor(factor, value => typeof value === "number" && value < 1, 5_000);
  const zoomedOut = await checkGeometry();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Toggle right sidebar", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await waitFor(factor, value => typeof value === "number" && Math.abs(value - zoomedOut.factor) < 0.001, 5_000);
  const afterReload = await checkGeometry();
  assert(Math.abs(afterReload.factor - zoomedOut.factor) < 0.001, "Preload overwrote the persisted native zoom after reload");
  await page.keyboard.press("Meta+=");
  await waitFor(factor, value => typeof value === "number" && Math.abs(value - 1) < 0.001, 5_000);
  await page.keyboard.press("Meta+=");
  await waitFor(factor, value => typeof value === "number" && Math.abs(value - 1.2) < 0.001, 5_000);
  const zoomedIn = await checkGeometry();
  await page.keyboard.press("Meta+0");
  await waitFor(factor, value => value === 1, 5_000);
  return { baseline, zoomedOut, zoomedIn, persistedOnReload: true, reset: true };
}

async function verifyWindowRelaunch(): Promise<Record<string, unknown>> {
  if (!native) return { skipped: "native relaunch requires Electron" };
  const left = page.getByRole("button", { name: "Toggle thread sidebar", exact: true }).filter({ visible: true }).last();
  if (await left.getAttribute("aria-pressed") === "true") await left.click();
  const right = page.getByRole("button", { name: "Toggle right sidebar", exact: true });
  if (await right.getAttribute("aria-pressed") !== "true") await right.click();
  const sidebarWidths = () => page.evaluate(() => Object.fromEntries(["left", "right"].map(side => {
    const element = document.querySelector<HTMLElement>(`[data-slot="sidebar"][data-side="${side}"]`);
    return [side, element ? parseFloat(getComputedStyle(element).getPropertyValue("--sidebar-width")) : 0];
  })));
  const savedWidths = await sidebarWidths();
  await page.keyboard.press("Meta+-");
  const savedZoom = await waitFor(() => page.evaluate(() => window.desktopBridge?.getZoomFactor?.()), value => typeof value === "number" && value < 1, 5_000);
  await closeBrowserBounded(browser);
  browser = await launchNative();
  page = await browser.firstWindow();
  page.on("pageerror", (error: Error) => errors.push(error.message));
  await page.getByRole("button", { name: "Toggle right sidebar", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await waitFor(() => page.evaluate(() => window.desktopBridge?.getZoomFactor?.()), value => value === savedZoom, 5_000);
  await waitFor<Record<string, number>>(sidebarWidths, value => ["left", "right"].every(side => Math.abs(value[side] - savedWidths[side]) < 2), 5_000);
  const restoredLeft = page.getByRole("button", { name: "Toggle thread sidebar", exact: true }).filter({ visible: true }).last();
  assert(await restoredLeft.getAttribute("aria-pressed") === "false", "Left sidebar did not survive app relaunch");
  assert(await page.getByRole("button", { name: "Toggle right sidebar", exact: true }).getAttribute("aria-pressed") === "true", "Right sidebar did not survive app relaunch");
  await page.keyboard.press("Meta+0");
  await waitFor(() => page.evaluate(() => window.desktopBridge?.getZoomFactor?.()), value => value === 1, 5_000);
  return { savedZoom, restoredZoom: savedZoom, savedWidths, restoredWidths: await sidebarWidths(), leftClosed: true, rightOpen: true };
}

async function verifySidebarSizesAndLeftToggle(): Promise<Record<string, unknown>> {
  const left = page.getByRole("button", { name: "Toggle thread sidebar", exact: true }).filter({ visible: true }).last();
  if (await left.getAttribute("aria-pressed") !== "true") await left.click();
  const nativeHitRegion = await left.evaluate((element: HTMLElement) => getComputedStyle(element.parentElement!).getPropertyValue("-webkit-app-region"));
  assert(nativeHitRegion === "no-drag", "Left navigation must exclude native window dragging");
  const toggleFrames: unknown[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const frames = await page.evaluate(async () => {
      const visibleButtons = () => Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="Toggle thread sidebar"]')).filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.x >= 0 && rect.right <= innerWidth && getComputedStyle(element).visibility !== "hidden";
      });
      const start = visibleButtons()[0]?.getBoundingClientRect();
      if (!start) throw new Error("Left toggle is missing");
      visibleButtons()[0]!.click();
      const samples = [];
      for (let frame = 0; frame < 24; frame++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const buttons = visibleButtons();
        const rect = buttons[0]?.getBoundingClientRect();
        samples.push({ count: buttons.length, drift: rect ? Math.max(Math.abs(rect.x - start.x), Math.abs(rect.y - start.y)) : 999 });
      }
      return samples;
    });
    assert(frames.every((frame: { count: number; drift: number }) => frame.count === 1 && frame.drift < 1), `Left toggle moved or duplicated during panel transition: ${JSON.stringify(frames)}`);
    toggleFrames.push({ maxDrift: Math.max(...frames.map((frame: { drift: number }) => frame.drift)), visibleCount: 1 });
  }
  await openLauncher();
  const width = async (side: string) => (await page.locator(`[data-slot="sidebar"][data-side="${side}"] > [data-slot="sidebar-gap"]`).boundingBox())?.width ?? 0;
  const saved: Record<string, number> = {};
  for (const side of ["left", "right"]) {
    const rail = side === "left" ? page.locator('[data-slot="sidebar-rail"][data-placement="content-seam"]').first() : page.locator('[data-slot="sidebar"][data-side="right"] [data-slot="sidebar-rail"]');
    const initial = await width(side);
    const box = await rail.boundingBox();
    assert(box, `Missing ${side} resize rail`);
    const targetWidth = initial + (side === "left" ? 44 : -60);
    await page.mouse.move(box.x + box.width / 2, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + (side === "left" ? 44 : 60), box.y + 120, { steps: 8 });
    await page.mouse.up();
    saved[side] = await waitFor(() => width(side), value => Math.abs(value - targetWidth) < 2, 5_000);
  }
  const right = page.getByRole("button", { name: "Toggle right sidebar", exact: true });
  await right.click();
  await right.click();
  await waitFor(() => width("right"), value => Math.abs(value - saved.right!) < 2, 5_000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await right.waitFor({ state: "visible", timeout: 20_000 });
  for (const side of ["left", "right"]) await waitFor(() => width(side), value => Math.abs(value - saved[side]!) < 2, 5_000);
  return { saved, restoredOnReopen: true, restoredOnReload: true, toggleFrames };
}

async function verifySidebarPersistence(): Promise<Record<string, unknown>> {
  const left = page.getByRole("button", { name: "Toggle thread sidebar", exact: true }).filter({ visible: true }).last();
  const right = page.getByRole("button", { name: "Toggle right sidebar", exact: true });
  const setState = async (control: any, open: boolean) => {
    if (await control.getAttribute("aria-pressed") !== String(open)) await control.click();
    await waitFor(() => control.getAttribute("aria-pressed"), value => value === String(open), 5_000);
  };
  const states: unknown[] = [];
  for (const open of [false, true]) {
    await setState(left, open);
    await setState(right, open);
    await page.reload({ waitUntil: "domcontentloaded" });
    await right.waitFor({ state: "visible", timeout: 20_000 });
    await waitFor(() => left.getAttribute("aria-pressed"), value => value === String(open), 5_000);
    await waitFor(() => right.getAttribute("aria-pressed"), value => value === String(open), 5_000);
    states.push({ open, leftRestored: true, rightRestored: true });
  }
  await setState(right, false);
  return { reloadStates: states };
}

async function verifyDockToggleLayout(): Promise<Record<string, unknown>> {
  const toggle = page.getByRole("button", { name: "Toggle right sidebar", exact: true });
  const visibleToggleCount = async () => await toggle.evaluateAll((nodes: Element[]) => nodes.filter((node: Element) => {
    const element = node as HTMLElement;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
  }).length);
  const closed = await toggle.boundingBox();
  const environmentButton = await page.getByRole("button", { name: "Toggle environment panel", exact: true }).boundingBox();
  assert(closed && environmentButton, "Missing header control bounds");
  const headerGap = closed.x - environmentButton.x - environmentButton.width;
  assert(headerGap >= 6 && headerGap <= 10, `Header controls must have a compact, consistent gap: ${headerGap}px`);
  const headerButtons = await Promise.all(["Open in IDE", "More actions", "Toggle environment panel"].map(name => page.getByRole("button", { name, exact: true }).boundingBox()));
  for (const box of headerButtons) assert(box && Math.abs(box.y - closed.y) < 1 && box.height === closed.height, "Header controls do not share a baseline and height");
  for (let index = 1; index < headerButtons.length; index++) {
    const previous = headerButtons[index - 1]!;
    const current = headerButtons[index]!;
    assert(Math.abs(current.x - previous.x - previous.width - headerGap) <= 1, "Header control gaps are inconsistent");
  }
  assert(await visibleToggleCount() === 1 && closed, "Expected one visible right-sidebar toggle in the closed state");
  await toggle.click();
  await page.getByRole("navigation", { name: "Open a panel", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  const opened = await toggle.boundingBox();
  assert(await visibleToggleCount() === 1 && opened, "Expected one visible right-sidebar toggle in the open state");
  await collapseDock();
  const restored = await toggle.boundingBox();
  assert(await visibleToggleCount() === 1 && restored, "Expected one visible right-sidebar toggle after collapse");
  const boxDrift = (left: NonNullable<typeof closed>, right: NonNullable<typeof closed>) => Math.max(
    Math.abs(left.x - right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.width - right.width),
    Math.abs(left.height - right.height),
  );
  const openedDrift = boxDrift(closed, opened);
  const restoredDrift = boxDrift(closed, restored);
  const drift = Math.max(openedDrift, restoredDrift);
  assert(openedDrift < 2, `Right-sidebar toggle moved ${openedDrift}px while opening`);
  assert(restoredDrift < 2, `Right-sidebar toggle moved ${restoredDrift}px after collapse`);
  return { visibleCount: 1, headerGap, closed, opened, restored, openedDriftPx: openedDrift, restoredDriftPx: restoredDrift, driftPx: drift };
}

async function clickPanel(label: string, name: string): Promise<PanelStatus> {
  const result: PanelStatus = { clicked: false, ok: false };
  try {
    const nav = await openLauncher();
    const button = nav.getByRole("button", { name: `Open ${label}`, exact: true });
    await button.waitFor({ state: "visible", timeout: 15_000 });
    await button.click();
    result.clicked = true;
    if (label === "Terminal") {
      await page.locator(".thread-terminal-drawer").waitFor({ state: "visible", timeout: 15_000 });
    } else if (label === "Files") {
      await page.getByRole("textbox", { name: "Search files", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
      await page.getByText("notes.txt", { exact: true }).first().click();
      await page.getByText("Original panel text", { exact: false }).first().waitFor({ timeout: 15_000 });
      const folder = page.getByRole("button", { name: "src", exact: true });
      await folder.hover();
      const folderHover = await folder.evaluate(async (node: HTMLElement) => {
        const samples: unknown[] = [];
        for (let i = 0; i < 40; i++) {
          const r = node.getBoundingClientRect();
          const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          samples.push({ connected: node.isConnected, cursor: target ? getComputedStyle(target).cursor : null, x: r.x, y: r.y, width: r.width, height: r.height });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return samples;
      });
      assert(new Set(folderHover.map((sample: unknown) => JSON.stringify(sample))).size === 1, `Folder hover is unstable: ${JSON.stringify(folderHover)}`);
      const path = page.getByRole("navigation", { name: "File path" });
      await path.hover();
      const pathHover = await path.evaluate(async (node: HTMLElement) => {
        const samples: unknown[] = [];
        for (let i = 0; i < 40; i++) {
          const r = node.getBoundingClientRect();
          const target = document.elementFromPoint(r.x + 10, r.y + r.height / 2);
          samples.push({ connected: node.isConnected, cursor: target ? getComputedStyle(target).cursor : null, text: node.innerText, width: r.width });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return samples;
      });
      assert(new Set(pathHover.map((sample: unknown) => JSON.stringify(sample))).size === 1, `File breadcrumb hover is unstable: ${JSON.stringify(pathHover)}`);
      assert(pathHover.every((sample: AnyRecord) => sample.cursor === "default"), "Static file breadcrumb must keep the arrow cursor over text and gaps");
      result.detail = { folderHover, pathHover };

    } else if (label === "Browser") {
      await page.getByPlaceholder("Search or enter a URL", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    }
    if (label === "Side chats") {
      const dock = page.locator("[data-right-dock-content]");
      await dock.getByText("Fixture response: Panel fixture prompt", { exact: true }).first().waitFor({ timeout: 20_000 });
      await dock.locator('[contenteditable="true"]').first().fill("Side chat follow-up");
      await dock.getByRole("button", { name: "Send message", exact: true }).click();
      await dock.getByText("Fixture response: Side chat follow-up", { exact: true }).first().waitFor({ timeout: 20_000 });
    }
    result.screenshot = await screenshot(name);
    result.ok = true;
  } catch (error) {
    result.error = recordError(error);
  } finally {
    await collapseDock();
  }
  panelResults[label] = result;
  assert(result.ok, `${label} UI failed: ${result.error}`);
  return result;
}

try {
  if (!native) await page.goto(appServer.url.toString(), { waitUntil: "networkidle", timeout: 45_000 });
  await page.bringToFront();
  await page.getByText("Panel fixture workspace", { exact: true }).first().waitFor({ timeout: 90_000 });
  await page.screenshot({ path: join(output, "home.png"), fullPage: true });
  await page.getByText("Panel fixture task", { exact: true }).first().click();
  const composer = page.locator('[contenteditable="true"]').first();
  await composer.waitFor({ state: "visible", timeout: 20_000 });

  if (process.argv.includes("--hover-only")) {
    const result = await clickPanel("Files", "files-hover");
    await writeFile(join(output, "result.json"), JSON.stringify({ native, ...result }, null, 2));
    assert(result.ok, result.error ?? "File hover failed");
  } else {
  // This is the user-facing regression at the heart of the smoke: the picker
  // must show the OMP catalog, not an empty/built-in Synara provider list.
  const pickerTrigger = page.getByRole("button", { name: "Change model and reasoning", exact: true });
  const initialTriggerBox = await pickerTrigger.boundingBox();
  assert((await pickerTrigger.innerText()).trim().length > 0, "Model trigger must show its selection");
  await pickerTrigger.click();
  const picker = page.locator("[data-model-picker-popup]");
  await picker.waitFor({ state: "visible", timeout: 20_000 });
  assert(await picker.getAttribute("data-composer-picker-motion") === "dropdown-menu-morph", "Model picker has the wrong transition");
  const pickerMotion = await picker.evaluate((element: HTMLElement) => ({ duration: getComputedStyle(element).transitionDuration, transition: getComputedStyle(element).transitionProperty }));
  assert(pickerMotion.duration.includes("0.2s") && !pickerMotion.transition.includes("width") && !pickerMotion.transition.includes("height"), `Model picker morph timing is missing: ${JSON.stringify(pickerMotion)}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionTransition = await picker.evaluate((element: HTMLElement) => getComputedStyle(element).transitionProperty);
  assert(reducedMotionTransition === "none", `Model picker ignores Reduce Motion: ${reducedMotionTransition}`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const pickerTabLabels: string[] = await picker.getByRole("tab").evaluateAll((nodes: Element[]) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? "").filter((label) => label.length > 0),
  );
  assert(
    !pickerTabLabels.some((label) => label.trim().toLowerCase() === "omp"),
    `Model picker leaked the internal OMP provider tab: ${pickerTabLabels.join(", ")}`,
  );
  const upstreamTabLabel = pickerTabLabels.find((label) => label.trim().toLowerCase() !== "starred");
  assert(upstreamTabLabel, `Model picker did not expose an upstream provider tab: ${pickerTabLabels.join(", ")}`);
  const upstreamTab = picker.getByRole("tab", { name: upstreamTabLabel, exact: true });
  await upstreamTab.click();
  await waitFor(
    () => upstreamTab.getAttribute("aria-selected"),
    (value) => value === "true",
    5_000,
  );
  const modelRow = picker.getByRole("menuitem").filter({ hasText: /Fixture model|fixture-model/i }).first();
  await modelRow.waitFor({ state: "visible", timeout: 20_000 });
  assert(await picker.getByRole("menuitem").filter({ hasText: /Fixture model|fixture-model/i }).count() === 1, "Model picker rendered duplicate fixture model rows");
  await screenshot("model-picker");
  await modelRow.click();
  await page.waitForFunction(() => !(document.querySelector("[data-model-picker-popup]") as HTMLElement | null)?.offsetParent, undefined, { timeout: 10_000 }).catch(() => undefined);
  assert((await pickerTrigger.getAttribute("title"))?.toLowerCase().includes("fixture"), "Model picker did not commit the fixture OMP model");

  assert(await page.getByRole("button", { name: "Change effort", exact: true }).count() === 0, "Standalone effort control must be removed");
  if (!(await picker.isVisible())) await pickerTrigger.click();
  const effortSlider = picker.getByRole("slider", { name: "Reasoning effort" });
  await effortSlider.waitFor({ state: "visible", timeout: 10_000 });
  const effortButtons = picker.getByRole("button", { name: /^Set effort to / });
  const effortLabels = await effortButtons.allTextContents();
  assert(effortLabels.some((label: string) => /^high$/i.test(label.trim())), "OMP advertised high effort is missing");
  assert(!effortLabels.some((label: string) => /xhigh|max/i.test(label)), "Effort picker invented unadvertised levels");
  await picker.getByRole("button", { name: /^Set effort to high$/i }).click();
  await waitFor<string>(() => pickerTrigger.getAttribute("title"), (value) => /high/i.test(value), 5_000);
  const selectedTriggerBox = await pickerTrigger.boundingBox();
  assert((await pickerTrigger.innerText()).toLowerCase().includes("fixture"), "Model trigger must show the selected fixture model");
  assert((await pickerTrigger.innerText()).toLowerCase().includes("high"), "Model trigger must show the selected effort");
  assert(initialTriggerBox && selectedTriggerBox && Math.abs(initialTriggerBox.width - selectedTriggerBox.width) < 0.5, "Model/effort selection resized the trigger");
  const initialContextMeter = page.getByRole("button", { name: /context window/i }).first();
  await initialContextMeter.waitFor({ state: "visible", timeout: 10_000 });
  assert((await initialContextMeter.getAttribute("aria-label"))?.includes("0%"), "Context meter must show model capacity before the first OMP turn");
  await page.keyboard.press("Escape");

  const headerActions = await headerActionsSmoke();
  const environment = await environmentSmoke();
  const dockLayout = await verifyDockToggleLayout();

  await composer.click();
  await composer.pressSequentially("Panel fixture prompt");
  const send = page.getByRole("button", { name: "Send message", exact: true });
  await send.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]') as HTMLButtonElement | null;
    return Boolean(button && !button.disabled);
  }, undefined, { timeout: 20_000 });
  await send.click();
  await page.getByText("Fixture response: Panel fixture prompt", { exact: true }).first().waitFor({ timeout: 20_000 });
  const effortCommand = host.host.store.listCommands(session.id).find(command => command.kind === "set_thinking_level" && (command.payload as AnyRecord)?.level === "high");
  assert(effortCommand && ["completed", "acknowledged"].includes(effortCommand.status), "Selected effort did not reach OMP");
  const contextMeter = page.getByRole("button", { name: /context window/i }).first();
  await contextMeter.waitFor({ state: "visible", timeout: 20_000 });
  assert((await contextMeter.getAttribute("aria-label"))?.includes("25%"), "Context meter did not show OMP occupancy");
  const meterBounds = await contextMeter.boundingBox();
  const modelBounds = await pickerTrigger.boundingBox();
  assert(meterBounds && modelBounds && meterBounds.x + meterBounds.width <= modelBounds.x + 1, "Context meter must precede the model/effort trigger");
  await contextMeter.click();
  await page.getByText("Active context limit: 128k tokens", { exact: true }).waitFor({ timeout: 5000 });
  await screenshot("context-window");
  await page.keyboard.press("Escape");
  await screenshot("conversation");

  // Open every real launcher entry through the UI. The native APIs below are
  // supplements for deterministic PTY/files/browser assertions.
  await clickPanel("Terminal", "terminal");
  await clickPanel("Files", "files");
  await clickPanel("Browser", "browser");
  await clickPanel("Side chats", "side-chats");

  if (native) {
    const terminal = await terminalSmoke();
    panelResults.Terminal.detail = terminal;
    panelResults.Terminal.ok = true;
    const files = await filesSmoke();
    panelResults.Files.detail = files;
    panelResults.Files.ok = true;
    const browserResult = await browserSmoke();
    panelResults.Browser.detail = browserResult;
    panelResults.Browser.ok = true;
  } else {
    for (const label of ["Terminal", "Files", "Browser"] as const) {
      panelResults[label] = {
        ...panelResults[label],
        ok: true,
        detail: "native panel bridge skipped in --browser mode",
      };
    }
  }

  // The launcher itself creates the sidechat; the durable marker and the
  // inherited OMP transcript must both point back to this source task.
  const sidechatSessions = await waitFor(
    async () => host.host.store.listSessions(project.id).map(candidate => host.host.sessionView(candidate)),
    (value) => value.some(candidate => candidate.id !== session.id && candidate.sidechatSourceThreadId === session.id),
    20_000,
  );
  const child = sidechatSessions.find(candidate => candidate.id !== session.id && candidate.sidechatSourceThreadId === session.id);
  assert(child, "Side chats launcher did not create a child session with source metadata");
  const sidechatChild = child;
  const childEvents = host.host.store.readEvents(sidechatChild.id).events;
  const inherited = childEvents.some(event => JSON.stringify(event).includes("Fixture response: Panel fixture prompt"));
  assert(inherited, "Sidechat child did not inherit the source fixture transcript");
  panelResults["Side chats"] = { ...panelResults["Side chats"], ok: true, detail: { childId: sidechatChild.id, sourceThreadId: sidechatChild.sidechatSourceThreadId, inheritedFixtureMessage: inherited } };

  const deviceLauncher = await openLauncher();
  await deviceLauncher.getByRole("button", { name: "Open iOS Simulator", exact: true }).click();
  await page.getByText("Install Xcode", { exact: true }).first().waitFor({ timeout: 15_000 });
  await screenshot("ios-simulator");
  panelResults["iOS Simulator"] = { clicked: true, ok: true, detail: "Synara setup-required checklist: Xcode unavailable" };
  await collapseDock();

  const sidebarSizes = await verifySidebarSizesAndLeftToggle();
  const sidebarPersistence = await verifySidebarPersistence();
  const desktopZoom = await verifyDesktopZoom();
  const relaunch = await verifyWindowRelaunch();

  if (errors.length > 0) throw new Error(`Renderer errors: ${errors.join("\n")}`);
  const result = {
    ok: true,
    native,
    providerCalls: 0,
    projectId: project.id,
    sourceSessionId: session.id,
    pickerTabs: pickerTabLabels,
    pickerMotion,
    effort: { labels: effortLabels, selected: "high", insideModelPicker: true, standalone: false },
    headerActions,
    environment,
    dockLayout,
    sidebarSizes,
    sidebarPersistence,
    desktopZoom,
    relaunch,
    panels: panelResults,
    ideTargets,
    errors,
    browserFixtureUrl,
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  await Promise.all(["failure.json", "failure.png"].map(name => rm(join(output, name), { force: true })));
  console.log(`Agent Window panel smoke passed: ${output}`);
  }
} catch (error) {
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => undefined);
  const sessions = host.host.store.listSessions(project.id).map(candidate => {
    const view = host.host.sessionView(candidate);
    return { id: view.id, title: view.title, status: view.status, sidechatSourceThreadId: view.sidechatSourceThreadId };
  });
  const commandRows = host.host.store.listCommands(session.id).map(command => ({ id: command.commandId, kind: command.kind, status: command.status, error: command.error }));
  const composerControls = await page.locator('button[aria-label="Send message"], button[aria-label="Sending"], button[aria-label="Connecting"]').evaluateAll((nodes: Element[]) => nodes.map(node => {
    const button = node as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    return { label: button.getAttribute("aria-label"), disabled: button.disabled, visible: rect.width > 0 && rect.height > 0, text: button.innerText };
  })).catch(() => []);
  const composerEditors = await page.locator('[contenteditable="true"]').evaluateAll((nodes: Element[]) => nodes.map(node => {
    const element = node as HTMLElement;
    const rect = element.getBoundingClientRect();
    return { text: element.innerText, ariaLabel: element.getAttribute("aria-label"), contenteditable: element.getAttribute("contenteditable"), visible: rect.width > 0 && rect.height > 0 };
  })).catch(() => []);
  const events = host.host.store.readEvents(session.id).events.slice(-80);
  const body = await page.locator("body").innerText().catch(() => "");
  await writeFile(join(output, "failure.json"), JSON.stringify({
    ok: false,
    native,
    error: recordError(error),
    errors,
    panels: panelResults,
    sessions,
    commands: commandRows,
    events,
    bridgeRequests: bridgeRequests.slice(-80),
    composerControls,
    composerEditors,
    body: body.slice(0, 40_000),
  }, null, 2));
  throw error;
} finally {
  await closeBrowserBounded(browser);
  appServer.stop(true);
  browserFixture.stop(true);
  fixtureFiles.dispose();
  await host.close();
  await rm(scratch, { recursive: true, force: true });
}
