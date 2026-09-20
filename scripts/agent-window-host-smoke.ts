/** Verify the packaged host starts without an IDE or pre-existing host. No provider calls. */
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createAgentHostGateway } from "../apps/macos/src/agent-window-main.ts";
const root = resolve(import.meta.dir, "..");
const stateDir = await mkdtemp(join(tmpdir(), "cedia-agent-host-start-"));
let pid: number | undefined;
try {
  const gateway = createAgentHostGateway({ appRoot: join(root, `VSCode-darwin-${process.arch}/Cedia.app/Contents/Resources/app`), parentPid: process.pid, stateDir });
  await Promise.all([gateway.ensure(), gateway.ensure()]);
  const descriptor = JSON.parse(await readFile(join(stateDir, "host.json"), "utf8"));
  pid = descriptor.pid;
  if (!Number.isSafeInteger(pid) || pid === process.pid) throw new Error("Expected an independent host process");
  const projects = await gateway.request("GET", "projects");
  if (!Array.isArray(projects) || projects.length !== 0) throw new Error("New host did not use its isolated state directory");
  const output = join(root, "dist/agent-window-native-smoke");
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "host-start.json"), JSON.stringify({ ok: true, startedWithoutIde: true, providerCalls: 0 }));
  console.log("Packaged Agent host startup passed without an IDE or existing host");
} finally {
  if (pid && pid !== process.pid) {
    try { process.kill(pid, "SIGTERM"); } catch {}
    for (let attempt = 0; attempt < 100; attempt++) {
      try { process.kill(pid, 0); } catch { break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  await rm(stateDir, { recursive: true, force: true });
}
