import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startHostServer } from "./server.ts";
import type { HostDescriptor } from "../../../packages/protocol/src/index.ts";

const stateDir = resolve(process.env.CARET_STATE_DIR ?? join(homedir(), "Library", "Application Support", "Caret", "host"));
async function healthy(): Promise<boolean> {
  try {
    const descriptor = JSON.parse(readFileSync(join(stateDir, "host.json"), "utf8")) as HostDescriptor;
    const url = new URL(descriptor.url);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return false;
    const response = await fetch(`${url.origin}/v1/health`, { headers: { Authorization: `Bearer ${descriptor.token}` }, signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json() as {protocolVersion?: number}).protocolVersion === 1;
  } catch { return false; }
}
async function main(): Promise<void> {
  const action = process.argv[2] ?? "serve";
  if (action === "status") { process.stdout.write((await healthy() ? "ready" : "offline") + "\n"); return; }
  if (action === "ensure") {
    if (await healthy()) return;
    mkdirSync(stateDir, { recursive: true, mode: 0o700 }); chmodSync(stateDir, 0o700);
    const log = openSync(join(stateDir, "host.log"), "a", 0o600);
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], { detached: true, stdio: ["ignore", log, log], env: process.env });
    let spawnFailure: Error | undefined;
    child.once("error", error => { spawnFailure = error; });
    child.unref(); closeSync(log);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnFailure) throw spawnFailure;
      if (await healthy()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Caret host did not become ready; inspect the private host log");
  }
  if (action !== "serve") throw new Error("Usage: caret-host [serve|ensure|status]");
  let fatalDuringStartup = false;
  let stopping = false;
  let server: Awaited<ReturnType<typeof startHostServer>> | undefined;
  const bundledOmp = resolve(dirname(fileURLToPath(import.meta.url)), "../omp/omp");
  const useBundled = !process.env.CARET_OMP_PATH && existsSync(bundledOmp);
  server = await startHostServer({ stateDir, ompExecutable: process.env.CARET_OMP_PATH ?? (useBundled ? bundledOmp : undefined),
    virtualUi: process.env.CARET_RPC_VIRTUAL_UI === "1" || (useBundled && process.env.CARET_RPC_VIRTUAL_UI !== "0"),
    editorBridge: process.env.CARET_RPC_EDITOR_BRIDGE === "1",
    nativeBridge: process.env.CARET_RPC_NATIVE_BRIDGE === "1" || (useBundled && process.env.CARET_RPC_NATIVE_BRIDGE !== "0"),
    onDiagnostic: message => process.stderr.write(`${message}\n`),
    onFatal: () => { fatalDuringStartup = true; if (server) void stop(1); } });
  if (fatalDuringStartup) { await stop(1); return; }
  async function stop(code = 0) { if (stopping) return; stopping = true; try { await server?.close(); process.exitCode = code; } catch { process.exitCode = 1; } }
  process.once("SIGTERM", () => void stop()); process.once("SIGINT", () => void stop());
  process.stdout.write("Caret host ready on authenticated loopback\n");
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Caret host failed"}\n`); process.exitCode = 1; });
