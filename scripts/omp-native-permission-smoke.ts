/** Real OMP + CediaHost permission gate, using only a loopback scripted model. */
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CediaHost } from "../apps/host/src/service.ts";
import { DurableStore } from "../apps/host/src/store.ts";
import type { Json, SessionEvent } from "../packages/protocol/src/index.ts";
import { attestOmpRuntime } from "./lib/omp-runtime-integrity.ts";

const root = resolve(import.meta.dir, "..");
const executable = process.env.CEDIA_OMP_BINARY ?? join(root, "dist/omp/omp");
const attestation = attestOmpRuntime(root, executable);
const dir = await mkdtemp(join(tmpdir(), "cedia-native-permission-"));
const workspace = join(dir, "workspace");
await mkdir(workspace);
let requests = 0;
let turnRequests = 0;
let effectFile = "";
const events: SessionEvent[] = [];
const check = (value: unknown, message: string): void => { if (!value) throw new Error(message); };
const exists = async (path: string): Promise<boolean> => { try { await access(path); return true; } catch { return false; } };
async function until(predicate: () => boolean | Promise<boolean>, label: string): Promise<void> {
  const deadline = performance.now() + 20000;
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out: ${label}`);
}
const server = createServer(async (req, res) => {
  try {
    check(req.method === "POST" && req.url === "/v1/chat/completions", "Unexpected fixture route");
    let body = "";
    for await (const chunk of req) { body += String(chunk); check(body.length < 2_000_000, "Fixture body too large"); }
    const input = JSON.parse(body);
    check(input.model === "native-fixture" && input.stream === true, "Unexpected fixture model");
    check(++requests <= 8, "Unexpected model loop");
    const useTool = ++turnRequests === 1;
    const delta = useTool
      ? { role: "assistant", tool_calls: [{ index: 0, id: `permission-${requests}`, type: "function", function: { name: "bash", arguments: JSON.stringify({ command: `printf approved > ${effectFile}` }) } }] }
      : { role: "assistant", content: "Fixture completed." };
    const chunk = (delta: unknown, finish: string | null) => ({ id: `fixture-${requests}`, object: "chat.completion.chunk", created: 0, model: "native-fixture", choices: [{ index: 0, delta, finish_reason: finish }] });
    res.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    res.end([chunk(delta, null), chunk({}, useTool ? "tool_calls" : "stop"), "[DONE]"].map(value => `data: ${typeof value === "string" ? value : JSON.stringify(value)}\n\n`).join(""));
  } catch { res.writeHead(500); res.end("Fixture rejected request"); }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("No fixture port");
await writeFile(join(dir, "models.yml"), `providers:\n  cedia-fixture:\n    baseUrl: http://127.0.0.1:${address.port}/v1\n    auth: none\n    api: openai-completions\n    models:\n      - id: native-fixture\n        name: Cedia local native permission fixture\n        reasoning: false\n        input: [text]\n        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}\n        contextWindow: 128000\n        maxTokens: 4096\n`);
const stateDir = join(dir, "host");
const store = DurableStore.open({ stateDir });
const host = new CediaHost({ store, stateDir, ompExecutable: executable, nativeBridge: true,
  ompEnv: { PATH: "/usr/bin:/bin", HOME: dir, PI_CODING_AGENT_DIR: dir, PI_NOTIFICATIONS: "off", TERM: "xterm-256color" },
  ompArgs: ["--no-skills", "--no-rules", "--no-extensions"], onEvent: event => events.push(event) });
try {
  const project = store.createProject({ path: workspace });
  const session = await host.startSession(host.createSession(project.id).id);
  let serial = 0;
  const command = (name: string, payload: Record<string, Json>) => host.command(session.id, "fixture-owner", { commandId: `native-${++serial}`, incarnation: session.incarnation, command: name, payload });
  for (const [name, payload] of [["set_model", { provider: "cedia-fixture", modelId: "native-fixture" }], ["set_auto_retry", { enabled: false }], ["set_auto_compaction", { enabled: false }]] as const) {
    const result = await command(name, payload); check(result.status === "completed", `Setup ${name}: ${result.error}`);
  }
  const checks: string[] = [];
  for (const decision of ["allow", "reject"] as const) {
    effectFile = join(workspace, `${decision}.txt`); turnRequests = 0;
    const firstEvent = events.length;
    const prompt = await command("prompt", { message: `Run the ${decision} permission fixture` });
    await until(() => host.pendingUi(session.id).length > 0, `${decision} permission prompt`);
    check(!await exists(effectFile), "Native effect occurred before permission");
    const pending = host.pendingUi(session.id)[0] as { token: string; request: { method: string; options: string[] } };
    check(pending.request.method === "select", "Permission must preserve structured options");
    const label = pending.request.options.find(option => decision === "allow" ? /allow once/i.test(option) : /^\d+\. Reject$/.test(option));
    check(label, `Missing ${decision} once option`);
    check(events.slice(firstEvent).some(event => JSON.stringify(event.frame).includes(`printf approved > ${effectFile}`)), "Journal lacks exact native arguments");
    const answer = await host.respond(session.id, "fixture-owner", { commandId: `answer-${decision}`, incarnation: session.incarnation, token: pending.token, answer: label! });
    check(answer.status === "completed", "Permission answer failed");
    await until(() => store.getCommand(session.id, prompt.commandId)?.status === "completed", `${decision} terminal turn`);
    check(await exists(effectFile) === (decision === "allow"), "Permission outcome did not control native effect");
    const stale = await host.respond(session.id, "fixture-owner", { commandId: `stale-${decision}`, incarnation: session.incarnation, token: pending.token, answer: label! });
    check(stale.status === "not_dispatched", "Expired decision was accepted");
    checks.push(`${decision}-once-before-native-bash-effect`, `${decision}-exact-arguments-journaled`, `${decision}-stale-answer-rejected`);
  }
  const evidence = join(root, "docs/maintenance/evidence/omp-native-permission-2026-09-13");
  await mkdir(evidence, { recursive: true });
  check(JSON.stringify(attestOmpRuntime(root, executable)) === JSON.stringify(attestation), "Runtime changed during probe");
  const receipt = { capturedAt: new Date().toISOString(), syntheticOnly: true, paidModelCalls: 0, modelRequests: requests, ...attestation, checks };
  await writeFile(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
} finally {
  await host.close(); store.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
}
