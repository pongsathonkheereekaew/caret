/** Exercise the shipped frontend against a real isolated Cedia host and a provider-free OMP fixture. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startHostServer } from "../apps/host/src/server.ts";
import { createAgentHostGateway, createAgentWindowHandler } from "../apps/macos/src/agent-window-main.ts";

const root = resolve(import.meta.dir, "..");
const native = process.argv.includes("--native");
const { chromium, _electron } = createRequire(join(root, "desktop/package.json"))("playwright");
const scratch = await mkdtemp(join(tmpdir(), "cedia-agent-ui-"));
const projectPath = join(scratch, "project");
await mkdir(projectPath);
await writeFile(join(projectPath, "hello.txt"), "Agent Window fixture\n");
const host = await startHostServer({
  stateDir: join(scratch, "host"),
  ompExecutable: join(root, "apps/macos/test/fixtures/agent-window-omp"),
  ompEnv: { CEDIA_NODE: process.execPath },
});
const project = host.host.store.createProject({ path: projectPath, name: "Agent Window fixture" });
const session = host.host.createSession(project.id, "Fixture task");
// Deliberately idle: the first send must start OMP before claiming its command.
const gateway = createAgentHostGateway({ appRoot: root, parentPid: process.pid, stateDir: join(scratch, "host") });
const ideTargets: unknown[] = [];
const handler = createAgentWindowHandler({
  ...gateway,
  authorize: () => true,
  pickFolder: async () => projectPath,
  openIde: async input => { ideTargets.push(input); },
  openExternal: async () => { throw new Error("External links are disabled in fixture tests"); },
  version: "fixture",
});
const output = join(root, native ? "dist/agent-window-native-smoke" : "dist/agent-window-smoke");
await mkdir(output, { recursive: true });
const assets = join(root, "dist/agent-window");
const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    const path = resolve(assets, `.${decodeURIComponent(url.pathname)}`);
    if (path !== assets && !path.startsWith(`${assets}/`)) return new Response("Not found", { status: 404 });
    const file = Bun.file(path === assets ? join(assets, "index.html") : path);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(join(assets, "index.html")));
  },
});
// Match the personal launcher before testing an ad-hoc re-signed application.
if (native) {
  try { execFileSync("security", ["delete-generic-password", "-s", "Cedia Safe Storage"], { stdio: "ignore" }); } catch {}
}
const browser = native ? await _electron.launch({
  executablePath: join(root, `VSCode-darwin-${process.arch}/Cedia.app/Contents/MacOS/Cedia`),
  args: ["--user-data-dir", join(scratch, "profile"), "--password-store=basic", "--use-inmemory-secretstorage", "--skip-welcome", "--skip-release-notes"],
  env: { ...process.env, CEDIA_STATE_DIR: join(scratch, "host"), CEDIA_HOST_NODE: "/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin/node" },
  timeout: 45_000,
}) : await chromium.launch({ headless: true, channel: "chromium" });
const page = native ? await browser.firstWindow() : await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
const errors: string[] = [];
page.on("pageerror", (error: Error) => errors.push(error.message));
page.on("console", (message: { type(): string; text(): string }) => { if (message.type() === "error") errors.push(message.text()); });
if (!native) {
await page.exposeBinding("__cediaFixtureInvoke", async (_source: unknown, channel: string, input: unknown) => {
  if (channel !== "vscode:cediaAgent") throw new Error(`Unexpected fixture IPC channel: ${channel}`);
  return handler({}, input);
});
await page.addInitScript(() => {
  const target = window as unknown as { __cediaFixtureInvoke(channel: string, input: unknown): Promise<unknown>; vscode: unknown };
  target.vscode = {
    context: { resolveConfiguration: async () => ({ windowId: 1, isSessionsWindow: true }) },
    process: { platform: "darwin", env: {} },
    ipcRenderer: {
      invoke: (channel: string, input: unknown) => target.__cediaFixtureInvoke(channel, input),
      send: () => {}, on: () => {}, once: () => {}, removeListener: () => {},
    },
  };
});
}
try {
  if (!native) await page.goto(server.url.toString(), { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByText("Agent Window fixture", { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.screenshot({ path: join(output, "home.png"), fullPage: true });
  await page.getByText("Fixture task", { exact: true }).first().click();
  const composer = page.locator('[contenteditable="true"]').first();
  await composer.waitFor({ state: "visible", timeout: 20_000 });
  await page.evaluate(() => {
    const target = window as any;
    target.__agentSmokeCommands = [];
    const originalApi = target.nativeApi;
    target.nativeApi = new Proxy(originalApi, { get(api, domain) {
      const value = api[domain];
      if (!value || typeof value !== "object") return value;
      return new Proxy(value, { get(group, method) {
        const fn = group[method];
        if (typeof fn !== "function" || String(method).startsWith("on")) return fn;
        return async (...args: unknown[]) => {
          const entry: any = { method: `${String(domain)}.${String(method)}`, args };
          target.__agentSmokeCommands.push(entry);
          try { return await fn.apply(group, args); } catch (error) { entry.error = String(error); throw error; }
        };
      } });
    } });
  });
  await composer.fill("Agent-first smoke test");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Fixture response: Agent-first smoke test", { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.screenshot({ path: join(output, "conversation.png"), fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Fixture response: Agent-first smoke test", { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.screenshot({ path: join(output, "restored.png"), fullPage: true });
  await page.getByText("Agent Window fixture", { exact: true }).first().hover();
  await page.getByRole("button", { name: "Create new thread in Agent Window fixture", exact: true }).click();
  await page.locator('[contenteditable="true"]').first().fill("New task smoke test");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Fixture response: New task smoke test", { exact: true }).first().waitFor({ timeout: 20_000 });
  if (host.host.store.listSessions(project.id).length !== 2) throw new Error("Creating a task did not preserve one durable identity");
  await page.getByText("Fixture task", { exact: true }).first().click();
  await page.getByText("Fixture response: Agent-first smoke test", { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Toggle environment panel", exact: true }).click();
  const ideOpened = native ? browser.waitForEvent("window", { predicate: (candidate: any) => candidate !== page, timeout: 30_000 }) : undefined;
  await page.getByRole("button", { name: "Open in Cedia IDE", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Cedia IDE", exact: true }).click();
  if (native) {
    const ide = await ideOpened;
    await ide.waitForURL(/workbench/, { timeout: 30_000 });
    await ide.locator(".monaco-workbench").waitFor({ timeout: 30_000 });
    const config = await ide.evaluate(async () => (window as any).vscode.context.resolveConfiguration());
    if (config.workspace?.uri?.path !== project.path) throw new Error("Native IDE opened the wrong project");
    await ide.bringToFront();
    await ide.keyboard.press("Meta+Shift+A");
    await page.waitForFunction(() => document.hasFocus(), { timeout: 20_000 });
    if (browser.windows().length !== 2) throw new Error("Returning to Agents created a duplicate window");
    await page.getByText("Fixture response: Agent-first smoke test", { exact: true }).first().waitFor();
    ideTargets.push({ cwd: config.workspace.uri.path, windowsAfterReturn: browser.windows().length });
    await page.screenshot({ path: join(output, "returned-from-ide.png"), fullPage: true });
  } else if (ideTargets.length !== 1 || (ideTargets[0] as { cwd: string }).cwd !== project.path) {
    throw new Error("IDE handoff did not preserve the task workspace");
  }
  if (errors.length) throw new Error(`Renderer errors: ${errors.join("\n")}`);
  await writeFile(join(output, "result.json"), JSON.stringify({ ok: true, providerCalls: 0, projectId: project.id, sessionId: session.id, ideTargets, errors }, null, 2));
  await Promise.all(["failure.json", "failure.png"].map(name => rm(join(output, name), { force: true })));
  console.log(`Agent Window UI smoke passed: ${output}`);
} catch (error) {
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true });
  await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), errors, ideTargets, frontendCommands: await page.evaluate(() => (window as any).__agentSmokeCommands), commands: host.host.store.listCommands(session.id), events: host.host.store.readEvents(session.id), body: await page.locator("body").innerText() }, null, 2));
  throw error;
} finally {
  await browser.close();
  server.stop(true);
  await host.close();
  await rm(scratch, { recursive: true, force: true });
}
