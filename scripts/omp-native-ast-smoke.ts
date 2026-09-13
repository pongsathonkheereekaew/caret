/** Real OMP native AST preview/resolve with an in-memory editor transport; no paid inference. */
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CaretHost } from "../apps/host/src/service.ts";
import { DurableStore } from "../apps/host/src/store.ts";
import { EditorConnections } from "../apps/host/src/editors.ts";
import type { EditorDocumentSnapshot } from "../packages/protocol/src/editor.ts";
import type { Json } from "../packages/protocol/src/index.ts";
import { attestOmpRuntime } from "./lib/omp-runtime-integrity.ts";
const root = resolve(import.meta.dir, "..");
const executable = process.env.CARET_OMP_BINARY ?? join(root, "dist/omp/omp");
const attestation = attestOmpRuntime(root, executable);
const headless = process.argv.includes("--headless");
const reject = process.argv.includes("--reject");
if (reject && !headless) throw new Error("--reject currently requires --headless");
const dir = await realpath(await mkdtemp(join(tmpdir(), "caret-native-ast-")));
const workspace = join(dir, "workspace"); await mkdir(workspace);
const path = join(workspace, "fixture.ts"); await writeFile(path, headless ? "oldCall('disk');\n" : "diskOnly();\n");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
let document: EditorDocumentSnapshot = { handle: { id: "fixture-buffer", uri: `file://${path}` }, path, uri: `file://${path}`, workspaceRoot: workspace, text: "oldCall('dirty');\n", documentVersion: 7, sha256: hash("oldCall('dirty');\n"), dirty: true, isUntitled: false, languageId: "plaintext", encoding: "utf8" };
const maxRequests = reject ? 5 : 4;
let requests = 0, reads = 0, applies = 0;
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const server = createServer(async (req, res) => {
  try {
    check(req.method === "POST" && req.url === "/v1/chat/completions", "Unexpected model route");
    let body = ""; for await (const chunk of req) { body += String(chunk); check(body.length < 2_000_000, "Model body limit"); }
    const input = JSON.parse(body); check(input.model === "editor-fixture" && input.stream, "Wrong fixture model");
    check(++requests <= maxRequests, "Unexpected model loop");
    if (requests === 2) check(JSON.stringify(input.messages).includes("oldCall"), "Native AST preview did not use unsaved buffer");
    if (requests === maxRequests) {
      const latest = [...input.messages].reverse().find((message: { role?: string }) => message.role === "tool");
      check(JSON.stringify(latest).includes(reject ? "oldCall" : "newCall"), `Native read mismatch: ${JSON.stringify(latest)}`);
    }
    const tool = requests === 1
      ? { name: "ast_edit", arguments: JSON.stringify({ paths: ["*.ts"], ops: [{ pat: "oldCall($$$ARGS)", out: "newCall($$$ARGS)" }] }) }
      : requests === 2 ? { name: "write", arguments: JSON.stringify({ path: "xd://resolve", content: "Apply the fixture preview" }) }
      : reject && requests === 3 ? { name: "write", arguments: JSON.stringify({ path: "xd://reject", content: "Discard the rejected fixture preview" }) }
      : { name: "read", arguments: JSON.stringify({ path }) };
    const delta = requests < maxRequests ? { role: "assistant", tool_calls: [{ index: 0, id: `ast-${requests}`, type: "function", function: tool }] } : { role: "assistant", content: "Fixture complete." };
    const frame = (delta: unknown, finish: string | null) => ({ id: `fixture-${requests}`, object: "chat.completion.chunk", created: 0, model: "editor-fixture", choices: [{ index: 0, delta, finish_reason: finish }] });
    res.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    res.end([frame(delta, null), frame({}, requests < maxRequests ? "tool_calls" : "stop"), "[DONE]"].map(value => `data: ${typeof value === "string" ? value : JSON.stringify(value)}\n\n`).join(""));
  } catch (error) { console.error(error); res.writeHead(500); res.end("Fixture rejected request"); }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); if (!address || typeof address === "string") throw new Error("No fixture port");
await writeFile(join(dir, "models.yml"), `providers:\n  caret-fixture:\n    baseUrl: http://127.0.0.1:${address.port}/v1\n    auth: none\n    api: openai-completions\n    models:\n      - id: editor-fixture\n        name: Caret local editor fixture\n        reasoning: false\n        input: [text]\n        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}\n        contextWindow: 128000\n        maxTokens: 4096\n`);
await writeFile(join(dir, "config.yml"), "tools:\n  xdev: false\nastEdit:\n  enabled: true\n");
const stateDir = join(dir, "host"), editors = new EditorConnections();
if (!headless) editors.register("fixture", [workspace]);
const store = DurableStore.open({ stateDir });
const host = new CaretHost({ store, stateDir, editors, ompExecutable: executable, editorBridge: true,
  ompEnv: { PATH: "/usr/bin:/bin", PI_CODING_AGENT_DIR: dir, PI_EDIT_VARIANT: "replace", PI_NOTIFICATIONS: "off", TERM: "xterm-256color" },
  ompArgs: ["--no-skills", "--no-rules", "--no-extensions", "--tools", "read,ast_edit,write"] });
let pollError: unknown;
const poll = setInterval(() => {
  if (headless) return;
  try {
    for (const request of editors.poll("fixture")) {
      if (request.kind === "read") { reads++; editors.respond("fixture", { kind: "read", requestId: request.requestId, document }); }
      else if (request.kind === "apply") {
        check(request.expectedVersion === document.documentVersion && request.expectedHash === document.sha256 && request.handle.id === document.handle.id, "Lost native editor guard");
        check(request.edits.length === 1 && request.edits[0]!.text === "newCall('dirty');\n", "Wrong native edit output");
        const text = request.edits[0]!.text; applies++;
        document = { ...document, text, documentVersion: document.documentVersion + 1, sha256: hash(text) };
        editors.respond("fixture", { kind: "apply", requestId: request.requestId, document, saved: false, undoPreserved: true });
      } else throw new Error("Unexpected editor operation");
    }
  } catch (error) { pollError = error; }
}, 10);
try {
  const project = store.createProject({ path: workspace }); const session = await host.startSession(host.createSession(project.id).id);
  let serial = 0;
  const command = (name: string, payload: Record<string, Json>) => host.command(session.id, "fixture-owner", { commandId: `editor-${++serial}`, incarnation: session.incarnation, command: name, payload });
  for (const [name, payload] of [["set_model", { provider: "caret-fixture", modelId: "editor-fixture" }], ["set_auto_retry", { enabled: false }], ["set_auto_compaction", { enabled: false }]] as const) check((await command(name, payload)).status === "completed", `Setup ${name} failed`);
  const prompt = await command("prompt", { message: "Preview AST edits, apply with resolve, then read the fixture buffer" });
  const deadline = performance.now() + 30000; let approvals = 0;
  while (performance.now() < deadline && store.getCommand(session.id, prompt.commandId)?.status !== "completed") {
    if (pollError) throw pollError;
    for (const pending of host.pendingUi(session.id) as { token: string; request: { method: string } }[]) {
      check(pending.request.method === "confirm", "Unexpected approval"); check(applies === 0, "Native edit happened before permission"); if (headless) check(await readFile(path, "utf8") === "oldCall('disk');\n", "Disk changed before permission"); approvals++;
      await host.respond(session.id, "fixture-owner", { commandId: `approve-${approvals}`, incarnation: session.incarnation, token: pending.token, answer: !reject });
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  check(store.getCommand(session.id, prompt.commandId)?.status === "completed", "Native editor turn did not complete");
  check((headless ? reads === 0 && applies === 0 : reads >= 2 && applies === 1) && approvals >= 1 && requests === maxRequests, `Missing read/apply or duplicate permission: ${JSON.stringify({reads,applies,approvals,requests})}`);
  if (!headless) check(document.text === "newCall('dirty');\n" && document.documentVersion === 8, "Wrong final editor buffer");
  check(await readFile(path, "utf8") === (headless ? (reject ? "oldCall('disk');\n" : "newCall('disk');\n") : "diskOnly();\n"), "Unexpected final disk content");
  check(JSON.stringify(attestOmpRuntime(root, executable)) === JSON.stringify(attestation), "Runtime changed during probe");
  const receipt = { capturedAt: new Date().toISOString(), syntheticOnly: true, realNativeEditor: false, paidModelCalls: 0, modelRequests: requests, ...attestation, checks: reject ? ["native-ast-headless-preview", "rejected-before-host-disk-effect", "native-read-after-rejection", "disk-unchanged", "correlated-turn-completion"] : headless ? ["native-ast-headless-preview", "native-resolve-host-guarded-disk-apply", "native-read-after-ast", "permission-before-effect", "exact-disk-result", "correlated-turn-completion"] : ["native-ast-dirty-only-match", "native-resolve-guarded-editor-apply", "native-read-after-ast", "permission-before-effect", "disk-unchanged", "correlated-turn-completion"] };
  const evidence = join(root, reject ? "docs/maintenance/evidence/omp-native-ast-headless-reject-2026-09-13" : headless ? "docs/maintenance/evidence/omp-native-ast-headless-2026-09-13" : "docs/maintenance/evidence/omp-native-ast-2026-09-13"); await mkdir(evidence, { recursive: true }); await writeFile(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
} finally { clearInterval(poll); await host.close(); editors.close(); store.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
