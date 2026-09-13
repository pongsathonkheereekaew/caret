/** Relocation acceptance for the bundled Node host and standalone OMP. */
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CaretHostClient } from "../apps/macos/src/api.ts";
import { fileSha256 } from "./lib/omp-runtime-integrity.ts";
const root = resolve(import.meta.dir, "..");
const fixture = await mkdtemp(join(tmpdir(), "caret-portable-"));
const runtime = join(fixture, "relocated runtime");
const stateDir = join(fixture, "private state");
const workspace = join(fixture, "workspace");
let complete = false;
let hostPid: number | undefined;
let client: CaretHostClient | undefined;
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
try {
  await cp(join(root, "dist/mac-extension/runtime"), runtime, { recursive: true, mode: constants.COPYFILE_FICLONE });
  await mkdir(workspace); await writeFile(join(workspace, "fixture.txt"), "portable fixture\n");
  const profile = join(fixture, "omp-profile"); await mkdir(profile);
  // A fresh profile intentionally has no provider; setup must still be reachable.
  const node = join(runtime, "node/bin/node"), cli = join(runtime, "host/cli.js");
  const env = { PATH: "/usr/bin:/bin", HOME: process.env.HOME, CARET_STATE_DIR: stateDir, PI_CODING_AGENT_DIR: join(fixture, "omp-profile"), TERM: "xterm-256color", CARET_RPC_EDITOR_BRIDGE: "1" };
  execFileSync(node, [cli, "ensure"], { cwd: workspace, env, timeout: 20000, stdio: "pipe" });
  client = await CaretHostClient.fromStateDir(stateDir, { timeoutMs: 25000 }); hostPid = client.descriptor.pid;
  check(Number.isSafeInteger(hostPid) && hostPid! > 1, "Invalid owned fixture host PID");
  check((await client.health() as { status?: string }).status === "ready", "Relocated host is not ready");
  const project = await client.createProject(workspace, "Portable runtime acceptance");
  const session = await client.startSession((await client.createSession({ projectId: project.id })).id);
  const result = await client.sendCommand(session.id, { commandId: "portable-state", incarnation: session.incarnation, command: "get_state", payload: {} });
  check(result.status === "completed", "Relocated OMP get_state failed");
  const pending = await client.getPendingUi(session.id); check(pending.length === 0, "Unexpected startup interaction");
  await client.stopSession(session.id);
  check(execFileSync(node, [cli, "status"], { cwd: workspace, env, encoding: "utf8" }).trim() === "ready", "Host did not remain alive after ensure helper exited");
  const receipt = { capturedAt: new Date().toISOString(), syntheticOnly: true, paidModelCalls: 0, nodeSha256: fileSha256(node), ompSha256: fileSha256(join(runtime, "omp/omp")), hostSha256: fileSha256(cli), checks: ["runtime-relocated-to-path-with-spaces", "no-bun-or-node-on-path-required", "detached-host-survives-launcher-exit", "bundled-omp-start-with-no-provider-and-get-state", "graceful-task-stop"] };
  const evidence = join(root, "docs/maintenance/evidence/portable-runtime-2026-09-13"); await mkdir(evidence, { recursive: true }); await writeFile(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt)); complete = true;
} finally {
  if (hostPid) {
    process.kill(hostPid, "SIGTERM");
    const deadline = performance.now() + 10000;
    while (performance.now() < deadline) {
      try { await readFile(join(stateDir, "host.json")); } catch { break; }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    try { await readFile(join(stateDir, "host.json")); throw new Error("Owned fixture host did not shut down; keeping its state for inspection"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  if (complete) await rm(fixture, { recursive: true, force: true });
  else console.error(`Retained failed portable fixture: ${fixture}`);
}
