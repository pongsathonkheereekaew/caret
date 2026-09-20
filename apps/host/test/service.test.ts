import { afterEach, describe, expect, it } from "bun:test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RPC_COMMAND_TYPES, type RpcCommandType } from "../../../packages/omp-adapter/src/types.ts";
import type { Json } from "../../../packages/protocol/src/index.ts";
import { EditorConnections } from "../src/editors.ts";
import { CediaHost } from "../src/service.ts";
import { DurableStore } from "../src/store.ts";

const fixture = fileURLToPath(new URL("./fixtures/fake-host-launcher", import.meta.url));
const fakeHostScript = fileURLToPath(new URL("./fixtures/fake-host.mjs", import.meta.url));
const fixtureNode = process.env.CEDIA_FIXTURE_NODE
  ?? (existsSync("/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin/node")
    ? "/Users/pond/.caret-tools/node-v24.18.0-darwin-arm64/bin/node"
    : process.execPath);
const lockFixture = fileURLToPath(new URL("./fixtures/runtime-lock-holder.mjs", import.meta.url));
const realOmp = process.env.CEDIA_OMP_BINARY ?? "/Users/pond/.local/bin/omp";

interface FixtureHost {
  directory: string;
  host: CediaHost;
  store: DurableStore;
  sessionId: string;
  incarnation?: string;
}

const fixtures: FixtureHost[] = [];
const directories: string[] = [];

function temporaryDirectory(prefix = "cedia-host-service-"): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

/**
 * A launcher whose `--version` probe takes ~300ms. The shared fixture answers the probe
 * instantly, so stretching it here is the only deterministic way to observe the window
 * in which the host is waiting on the probe and has not rotated the incarnation yet.
 */
function slowProbeExecutable(): string {
  const path = join(temporaryDirectory("cedia-slow-probe-"), "omp-slow-probe");
  writeFileSync(path, `#!/bin/sh\nif [ "\${1:-}" = "--version" ]; then sleep 0.3; printf 'omp/18.1.18\\n'; exit 0; fi\nexec "$CEDIA_NODE" "${fakeHostScript}" "$@"\n`, { mode: 0o755 });
  return path;
}

function makeHost(mode = "normal", ompExecutable = fixture, extraEnv: NodeJS.ProcessEnv = {}): FixtureHost {
  const directory = temporaryDirectory();
  const projectPath = join(directory, "project");
  mkdirSync(projectPath, { recursive: true });
  const store = DurableStore.open({ stateDir: directory, recover: false });
  const project = store.createProject({ path: projectPath, name: "Fixture project" });
  const host = new CediaHost({
    store,
    stateDir: directory,
    ompExecutable,
    nativeBridge: mode === "native-permission",
    ompEnv: { CEDIA_NODE: fixtureNode, CEDIA_FAKE_HOST_MODE: mode, ...extraEnv },
  });
  const session = host.createSession(project.id, "Fixture task");
  const fixtureHost = { directory, host, store, sessionId: session.id };
  fixtures.push(fixtureHost);
  return fixtureHost;
}

async function waitFor(predicate: () => boolean, timeoutMs = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for Cedia host state");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

function waitForOutput(child: ChildProcess, expected: RegExp, timeoutMs = 2_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${expected}: ${output}`)), timeoutMs);
    const onData = (chunk: Buffer | string) => {
      output += String(chunk);
      if (expected.test(output)) finish();
    };
    const onError = (error: Error) => finish(error);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("error", onError);
      if (error) reject(error); else resolve(output);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("error", onError);
  });
}

function waitForExit(child: ChildProcess, timeoutMs = 2_000): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("fixture process did not exit")), timeoutMs);
    child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
  });
}

afterEach(async () => {
  for (const fixtureHost of fixtures.splice(0)) {
    await fixtureHost.host.close().catch(() => {});
    fixtureHost.store.close();
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("CediaHost", () => {
  it("forks a sidechat through OMP into its own session directory and keeps the source intact", async () => {
    const forkArgsLog = join(temporaryDirectory("cedia-fork-args-"), "args.json");
    const fixtureHost = makeHost("fork", fixture, { CEDIA_FAKE_FORK_ARGS_LOG: forkArgsLog });
    const source = await fixtureHost.host.startSession(fixtureHost.sessionId);
    const sourceFile = source.sessionFile;

    const child = await fixtureHost.host.forkSession(source.id, "Sidechat", "sidechat-child");
    expect(child).toMatchObject({ id: "sidechat-child", title: "Sidechat", projectId: source.projectId, cwd: source.cwd });
    expect(child.sidechatSourceThreadId).toBe(source.id);
    expect(child.sessionFile).not.toBe(join(fixtureHost.directory, "sessions", child.id, "session.jsonl"));
    expect(child.sessionFile).toContain(join(fixtureHost.directory, "sessions", child.id));
    expect(JSON.parse(readFileSync(forkArgsLog, "utf8"))).toMatchObject({ source: sourceFile, sessionDir: join(fixtureHost.directory, "sessions", child.id) });
    expect(fixtureHost.store.getSession(source.id)?.sessionFile).toBe(sourceFile);
    expect(JSON.parse(readFileSync(join(fixtureHost.directory, "sessions", child.id, "sidechat.json"), "utf8"))).toMatchObject({ sourceThreadId: source.id });

    const inherited = fixtureHost.store.readEvents(child.id).events.find(event => (event.frame as { command?: string }).command === "get_messages");
    expect(inherited?.frame).toMatchObject({ type: "response", command: "get_messages", success: true, data: { messages: [{ role: "user", text: "inherited" }] } });

    const repeated = await fixtureHost.host.forkSession(source.id, "Ignored title", child.id);
    expect(repeated.id).toBe(child.id);
    expect(repeated.title).toBe("Sidechat");
    const other = fixtureHost.host.createSession(source.projectId, "Other source");
    await expect(fixtureHost.host.forkSession(other.id, "Wrong", child.id)).rejects.toMatchObject({ code: "sidechat_conflict" });
  });

  it("rejects a fork whose OMP state escapes the child directory and cleans only the child", async () => {
    const outside = join(temporaryDirectory("cedia-fork-outside-"), "outside.jsonl");
    const fixtureHost = makeHost("fork-outside", fixture, { CEDIA_FAKE_FORK_SESSION_FILE: outside });
    const source = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const sourceFile = source.sessionFile;
    await expect(fixtureHost.host.forkSession(source.id, "Broken sidechat", "sidechat-bad")).rejects.toMatchObject({ code: "session_mismatch" });
    expect(fixtureHost.store.getSession(source.id)?.sessionFile).toBe(sourceFile);
    expect(fixtureHost.store.getSession("sidechat-bad")).toBeUndefined();
    expect(existsSync(join(fixtureHost.directory, "sessions", "sidechat-bad"))).toBe(false);
  });

  it("materializes an empty source through OMP before forking without adding a prompt", async () => {
    const fixtureHost = makeHost("fork");
    const source = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    expect(existsSync(source.sessionFile)).toBe(false);
    const child = await fixtureHost.host.forkSession(source.id, "Empty sidechat", "empty-sidechat");
    expect(existsSync(source.sessionFile)).toBe(true);
    expect(child.sidechatSourceThreadId).toBe(source.id);
    const sourceEvents = fixtureHost.store.readEvents(source.id).events;
    expect(fixtureHost.store.getSession(source.id)?.status).toBe("idle");
    expect(sourceEvents.some(event => (event.frame as { command?: string }).command === "prompt")).toBe(false);
  });

  it("shares one managed source runtime when empty-source sidechats fork concurrently", async () => {
    const fixtureHost = makeHost("fork");
    const source = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const [left, right] = await Promise.all([
      fixtureHost.host.forkSession(source.id, "Left sidechat", "left-sidechat"),
      fixtureHost.host.forkSession(source.id, "Right sidechat", "right-sidechat"),
    ]);
    expect(left.sessionFile).not.toBe(join(fixtureHost.directory, "sessions", left.id, "session.jsonl"));
    expect(right.sessionFile).not.toBe(join(fixtureHost.directory, "sessions", right.id, "session.jsonl"));
    expect(fixtureHost.store.getSession(source.id)?.status).toBe("idle");
    expect(fixtureHost.store.readEvents(source.id).events.some(event => (event.frame as { command?: string }).command === "prompt")).toBe(false);
  });

  it("waits for a concurrent idempotent fork instead of returning the pre-fork session path", async () => {
    const fixtureHost = makeHost("fork");
    const source = await fixtureHost.host.startSession(fixtureHost.sessionId);
    const [first, second] = await Promise.all([
      fixtureHost.host.forkSession(source.id, "Sidechat", "concurrent-sidechat"),
      fixtureHost.host.forkSession(source.id, "Ignored title", "concurrent-sidechat"),
    ]);
    expect(first.sessionFile).toBe(second.sessionFile);
    expect(second.sessionFile).not.toBe(join(fixtureHost.directory, "sessions", "concurrent-sidechat", "session.jsonl"));
  });

  it("starts one OMP session, keeps ACK separate from prompt completion, and deduplicates commands", async () => {
    const fixtureHost = makeHost();
    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    fixtureHost.incarnation = started.incarnation;
    expect(started.status).toBe("idle");

    const request = {
      commandId: "prompt-1",
      incarnation: started.incarnation,
      command: "prompt" as const,
      payload: { message: "hello fixture" },
    };
    const acknowledged = await fixtureHost.host.command(fixtureHost.sessionId, "owner", request);
    expect(acknowledged).toMatchObject({ commandId: "prompt-1", kind: "prompt" });
    expect(["acknowledged", "completed"]).toContain(acknowledged.status);
    await waitFor(() => fixtureHost.store.getCommand(fixtureHost.sessionId, "prompt-1")?.status === "completed");
    const completed = fixtureHost.store.getCommand(fixtureHost.sessionId, "prompt-1");
    expect(completed).toMatchObject({ status: "completed", result: { type: "prompt_result" } });
    expect(completed).toBeDefined();

    const duplicate = await fixtureHost.host.command(fixtureHost.sessionId, "owner", request);
    expect(duplicate).toEqual(completed!);
    const events = fixtureHost.store.readEvents(fixtureHost.sessionId).events;
    expect(events.some(event => (event.frame as { type?: string }).type === "agent_start")).toBe(true);
    expect(events.some(event => (event.frame as { type?: string }).type === "prompt_result")).toBe(true);

    const stopped = await fixtureHost.host.stopSession(fixtureHost.sessionId);
    expect(stopped.status).toBe("stopped");
  });

  it("does not persist running while OMP is still starting and lands on idle", async () => {
    const fixtureHost = makeHost("delay-ready");
    const initial = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const starting = fixtureHost.host.startSession(fixtureHost.sessionId);
    // Wait for the incarnation rotation so this read proves the status that the old code
    // wrote at exactly that point. The ready frame is still pending.
    await waitFor(() => fixtureHost.store.getSession(fixtureHost.sessionId)?.incarnation !== initial.incarnation);
    expect(fixtureHost.store.getSession(fixtureHost.sessionId)?.status).not.toBe("running");
    const started = await starting;
    expect(started.status).toBe("idle");
    await fixtureHost.host.stopSession(fixtureHost.sessionId);
  });

  it("refuses commands transiently while a start is in flight and accepts them after", async () => {
    const fixtureHost = makeHost("delay-ready");
    const initial = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const starting = fixtureHost.host.startSession(fixtureHost.sessionId);
    await waitFor(() => fixtureHost.store.getSession(fixtureHost.sessionId)?.incarnation !== initial.incarnation);
    const incarnation = fixtureHost.store.getSession(fixtureHost.sessionId)!.incarnation;
    await expect(fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "during-start",
      incarnation,
      command: "prompt",
      payload: { message: "hi" },
    })).rejects.toMatchObject({ code: "session_starting" });
    // Transient means transient: the refusal leaves no row for a client to replay forever.
    expect(fixtureHost.store.getCommand(fixtureHost.sessionId, "during-start")).toBeUndefined();
    const started = await starting;
    const accepted = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "during-start",
      incarnation: started.incarnation,
      command: "prompt",
      payload: { message: "hi" },
    });
    expect(["acknowledged", "completed"]).toContain(accepted.status);
  });

  it("still returns an existing command row while a start is in flight", async () => {
    const fixtureHost = makeHost("delay-ready");
    const initial = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const before = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "replay-during-start",
      incarnation: initial.incarnation,
      command: "prompt",
      payload: { message: "queued" },
    });
    expect(before.status).toBe("not_dispatched");
    const starting = fixtureHost.host.startSession(fixtureHost.sessionId);
    await waitFor(() => fixtureHost.store.getSession(fixtureHost.sessionId)?.incarnation !== initial.incarnation);
    const replayed = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "replay-during-start",
      incarnation: initial.incarnation,
      command: "prompt",
      payload: { message: "queued" },
    });
    expect(replayed).toEqual(before);
    await starting;
  });

  it("keeps the event loop serving reads while the version probe is in flight", async () => {
    const fixtureHost = makeHost("normal", slowProbeExecutable());
    const initial = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const starting = fixtureHost.host.startSession(fixtureHost.sessionId);
    // The probe is still running, so the rotation below it has not happened. A synchronous
    // probe would have frozen this thread past both, and the read would see the new
    // incarnation (or could not run at all until the start resolved).
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(fixtureHost.store.getSession(fixtureHost.sessionId)?.incarnation).toBe(initial.incarnation);
    const started = await starting;
    expect(started.status).toBe("idle");
    expect(started.incarnation).not.toBe(initial.incarnation);
  });

  it("claims commands before dispatch and marks a live OMP loss as unknown without replay", async () => {
    const fixtureHost = makeHost();
    const session = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const notDispatched = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "before-start",
      incarnation: session.incarnation,
      command: "prompt",
      payload: { message: "queued" },
    });
    expect(notDispatched.status).toBe("not_dispatched");

    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    const unknownFixture = makeHost("exit-after-ack");
    const unknownStarted = await unknownFixture.host.startSession(unknownFixture.sessionId);
    const unknown = await unknownFixture.host.command(unknownFixture.sessionId, "owner", {
      commandId: "lost-1",
      incarnation: unknownStarted.incarnation,
      command: "prompt",
      payload: { message: "the process will exit" },
    });
    expect(["acknowledged", "completed"]).toContain(unknown.status);
    await waitFor(() => unknownFixture.store.getSession(unknownFixture.sessionId)?.status === "recovery_required");
    expect(unknownFixture.store.getCommand(unknownFixture.sessionId, "lost-1")?.status).toBe("outcome_unknown");
    await expect(unknownFixture.host.startSession(unknownFixture.sessionId)).rejects.toMatchObject({ code: "recovery_required" });
    expect(unknownFixture.host.reconcile(unknownFixture.sessionId).status).toBe("stopped");
    await fixtureHost.host.stopSession(fixtureHost.sessionId);
    expect(started.status).toBe("idle");
  });

  it("treats a local-only prompt ACK as completion and does not wait for an agent event", async () => {
    const fixtureHost = makeHost("local-only");
    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    const command = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "local-only-1",
      incarnation: started.incarnation,
      command: "prompt",
      payload: { message: "/local-command" },
    });
    expect(command.status).toBe("completed");
    expect(command.result).toMatchObject({ meaning: "OMP command acknowledged", data: { agentInvoked: false } });
    // A second turn is accepted immediately because the local command never
    // became an active model turn.
    const second = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "local-only-2",
      incarnation: started.incarnation,
      command: "prompt",
      payload: { message: "/another-local-command" },
    });
    expect(second.status).toBe("completed");
  });

  it("classifies every pinned RPC command as ACK-complete, turn-ack, or not_dispatched", async () => {
    const fixtureHost = makeHost();
    const session = fixtureHost.store.getSession(fixtureHost.sessionId)!;
    const offline = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "offline-get-state",
      incarnation: session.incarnation,
      command: "get_state",
    });
    expect(offline.status).toBe("not_dispatched");

    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    const sessionFile = fixtureHost.store.getSession(fixtureHost.sessionId)!.sessionFile;
    const payloads: Record<RpcCommandType, { [key: string]: Json }> = {
      negotiate_protocol: { protocolVersion: 2 },
      prompt: { message: "o11-prompt" },
      steer: { message: "o11-steer" },
      follow_up: { message: "o11-follow-up" },
      abort: {},
      abort_and_prompt: { message: "o11-abort-and-prompt" },
      new_session: {},
      get_state: {},
      set_fast_mode: { enabled: false },
      get_available_commands: {},
      set_todos: { phases: [] },
      set_host_tools: { tools: [] },
      set_host_uri_schemes: { schemes: [] },
      set_subagent_subscription: { level: "off" },
      get_subagents: {},
      get_subagent_messages: {},
      set_model: { provider: "cedia-fixture", modelId: "cedia-fixture-model" },
      cycle_model: {},
      get_available_models: {},
      set_thinking_level: { level: "off" },
      cycle_thinking_level: {},
      set_steering_mode: { mode: "all" },
      set_follow_up_mode: { mode: "all" },
      set_interrupt_mode: { mode: "immediate" },
      compact: {},
      set_auto_compaction: { enabled: false },
      set_auto_retry: { enabled: false },
      abort_retry: {},
      bash: { command: "printf o11" },
      abort_bash: {},
      get_session_stats: {},
      export_html: {},
      switch_session: { sessionPath: sessionFile },
      branch: { entryId: "entry-1" },
      get_branch_messages: {},
      get_last_assistant_text: {},
      set_session_name: { name: "o11-fixture" },
      handoff: { customInstructions: "o11-handoff" },
      get_messages: {},
      get_messages_page: { limit: 10 },
      get_login_providers: {},
      login: { providerId: "cedia-fixture" },
    };
    expect(Object.keys(payloads)).toEqual([...RPC_COMMAND_TYPES]);

    for (const command of RPC_COMMAND_TYPES) {
      const result = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
        commandId: `o11-${command}`,
        incarnation: started.incarnation,
        command,
        payload: payloads[command],
      });
      if (command === "prompt") {
        expect(["acknowledged", "completed"]).toContain(result.status);
        await waitFor(() => fixtureHost.store.getCommand(fixtureHost.sessionId, `o11-${command}`)?.status === "completed");
        continue;
      }
      if (command === "abort_and_prompt") {
        expect(result.status).toBe("acknowledged");
        continue;
      }
      expect(result.status).toBe("completed");
      expect(result.result).toMatchObject({ meaning: "OMP command acknowledged" });
    }
    await fixtureHost.host.stopSession(fixtureHost.sessionId);
  });

  it("completes a handoff ACK without requiring a later agent_end frame", async () => {
    const fixtureHost = makeHost("handoff-no-end");
    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    const command = await fixtureHost.host.command(fixtureHost.sessionId, "owner", {
      commandId: "handoff-1",
      incarnation: started.incarnation,
      command: "handoff",
      payload: { customInstructions: "fixture handoff" },
    });
    expect(command.status).toBe("completed");
    expect(command.result).toMatchObject({ meaning: "OMP command acknowledged", data: { fixture: "handoff-no-end" } });
  });

  it("serializes concurrent stop/start calls and never starts over an unexpected closed process", async () => {
    const fixtureHost = makeHost();
    const firstStart = fixtureHost.host.startSession(fixtureHost.sessionId);
    const stop = fixtureHost.host.stopSession(fixtureHost.sessionId);
    const restart = fixtureHost.host.startSession(fixtureHost.sessionId);
    const [first, stopped, restarted] = await Promise.all([firstStart, stop, restart]);
    expect(first.status).toBe("idle");
    expect(stopped.status).toBe("stopped");
    expect(restarted.status).toBe("idle");
    expect(restarted.incarnation).not.toBe(first.incarnation);
    expect(fixtureHost.store.getSession(fixtureHost.sessionId)?.status).toBe("idle");
    await fixtureHost.host.stopSession(fixtureHost.sessionId);

    const unexpected = makeHost("exit-after-start");
    const unexpectedStarted = await unexpected.host.startSession(unexpected.sessionId);
    expect(unexpectedStarted.status).toBe("idle");
    await waitFor(() => unexpected.store.getSession(unexpected.sessionId)?.status === "recovery_required");
    await expect(unexpected.host.startSession(unexpected.sessionId)).rejects.toMatchObject({ code: "recovery_required" });
  });

  it("deletes a session: runtime stopped, record gone, the host's own files removed", async () => {
    const fixtureHost = makeHost();
    await fixtureHost.host.startSession(fixtureHost.sessionId);
    const sessionDirectory = join(fixtureHost.directory, "sessions", fixtureHost.sessionId);
    expect(existsSync(sessionDirectory)).toBe(true);
    await fixtureHost.host.deleteSession(fixtureHost.sessionId);
    expect(fixtureHost.store.getSession(fixtureHost.sessionId)).toBeUndefined();
    expect(existsSync(sessionDirectory)).toBe(false);
    // The id is gone for good: a second delete is a not-found, not a silent success.
    await expect(fixtureHost.host.deleteSession(fixtureHost.sessionId)).rejects.toMatchObject({ code: "not_found" });
    // The runtime is no longer tracked, so a later start cannot resurrect it.
    await expect(fixtureHost.host.startSession(fixtureHost.sessionId)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("real OMP session ownership", () => {
  it("denies a second OMP process on the same session lock before host tools are initialized", async () => {
    // Keep this integration provider-free: no prompt is sent, and OMP is
    // configured with isolated local directories and disabled discovery.
    if (!existsSync(realOmp)) return;
    const projectPath = temporaryDirectory("cedia-real-omp-project-");
    const firstDir = temporaryDirectory("cedia-real-omp-first-");
    const secondDir = temporaryDirectory("cedia-real-omp-second-");
    const environment = {
      PATH: process.env.PATH ?? `${dirname(realOmp)}:/usr/bin:/bin`,
      HOME: firstDir,
      PI_CODING_AGENT_DIR: firstDir,
      PI_NO_PTY: "1",
      PI_NOTIFICATIONS: "off",
    };
    const localModels = `providers:\n  cedia-lock-fixture:\n    baseUrl: http://127.0.0.1:9/v1\n    auth: none\n    api: openai-completions\n    models:\n      - id: cedia-lock-fixture-model\n        name: Cedia lock fixture\n        api: openai-completions\n        reasoning: false\n        input: [text]\n        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}\n        contextWindow: 128000\n        maxTokens: 4096\n`;
    writeFileSync(join(firstDir, "models.yml"), localModels, { mode: 0o600 });
    writeFileSync(join(secondDir, "models.yml"), localModels, { mode: 0o600 });
    const firstStore = DurableStore.open({ stateDir: firstDir, recover: false });
    const secondStore = DurableStore.open({ stateDir: secondDir, recover: false });
    const firstProject = firstStore.createProject({ path: projectPath, name: "Real OMP first" });
    const secondProject = secondStore.createProject({ path: projectPath, name: "Real OMP second" });
    const firstHost = new CediaHost({ store: firstStore, stateDir: firstDir, ompExecutable: realOmp,
      ompArgs: ["--no-skills", "--no-rules", "--no-extensions"], ompEnv: environment });
    const secondHost = new CediaHost({ store: secondStore, stateDir: secondDir, ompExecutable: realOmp,
      ompArgs: ["--no-skills", "--no-rules", "--no-extensions"], ompEnv: { ...environment, HOME: secondDir, PI_CODING_AGENT_DIR: secondDir } });
    const firstSession = firstHost.createSession(firstProject.id, "Real OMP lock owner");
    const secondSession = secondHost.createSession(secondProject.id, "Real OMP lock contender");
    // Seed an empty session file so both OMP processes can open the same
    // session inode while each Cedia store keeps its own metadata. The lock
    // database is hard-linked as well, making the extension's BEGIN EXCLUSIVE
    // conflict deterministic without asking OMP to open an external path.
    writeFileSync(firstSession.sessionFile, "", { mode: 0o600 });
    try {
      const started = await firstHost.startSession(firstSession.id);
      expect(started.status).toBe("idle");
      linkSync(firstSession.sessionFile, secondSession.sessionFile);
      linkSync(join(dirname(firstSession.sessionFile), "owner.sqlite"), join(dirname(secondSession.sessionFile), "owner.sqlite"));
      const contention = await secondHost.startSession(secondSession.id).catch(error => error);
      expect(contention).toBeInstanceOf(Error);
      expect(String(contention)).toMatch(/owned|lock|exited/i);
      expect(secondStore.getSession(secondSession.id)?.status).toBe("stopped");
    } finally {
      await secondHost.close().catch(() => {});
      await firstHost.close().catch(() => {});
      firstStore.close();
      secondStore.close();
    }
  }, 30_000); // Two real OMP cold starts can exceed Bun's 5-second unit-test default.

  it("starts standalone OMP with the packaged editor and permission bridges", async () => {
    const standalone = join(fileURLToPath(new URL("../../..", import.meta.url)), "dist/omp-standalone/omp");
    if (!existsSync(standalone)) return;
    const directory = temporaryDirectory("cedia-editor-bridge-");
    const projectPath = join(directory, "project");
    mkdirSync(projectPath);
    writeFileSync(join(directory, "models.yml"), `providers:\n  probe:\n    baseUrl: http://127.0.0.1:9/v1\n    auth: none\n    api: openai-completions\n    models:\n      - id: probe-model\n        name: Probe\n        api: openai-completions\n        reasoning: false\n        input: [text]\n        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}\n        contextWindow: 128000\n        maxTokens: 4096\n`, { mode: 0o600 });
    const store = DurableStore.open({ stateDir: directory, recover: false });
    const project = store.createProject({ path: projectPath, name: "Editor bridge" });
    const editors = new EditorConnections();
    const host = new CediaHost({
      store,
      stateDir: directory,
      editors,
      ompExecutable: standalone,
      editorBridge: true,
      nativeBridge: true,
      ompArgs: ["--no-skills", "--no-rules", "--no-extensions"],
      ompEnv: {
        PATH: "/usr/bin:/bin",
        HOME: directory,
        PI_CODING_AGENT_DIR: directory,
        PI_NO_PTY: "1",
        PI_NOTIFICATIONS: "off",
      },
    });
    try {
      const session = host.createSession(project.id, "Editor bridge session");
      const started = await host.startSession(session.id);
      expect(started.status).toBe("idle");
      const state = await host.command(session.id, "owner", {
        commandId: "bridge-state",
        incarnation: started.incarnation,
        command: "get_state",
      });
      expect(state.status).toBe("completed");
      await host.stopSession(session.id);
    } finally {
      await host.close().catch(() => {});
      store.close();
    }
  }, 30_000);
});

describe("OMP runtime lock extension", () => {
  it("keeps the session owner lock in the OMP process and releases it after a crash", async () => {
    const sqliteProbe = spawnSync(fixtureNode, ["-e", "import('node:sqlite').then(() => process.exit(0)).catch(() => process.exit(1))"], { encoding: "utf8" });
    if (sqliteProbe.status !== 0) return;
    const directory = temporaryDirectory("cedia-runtime-lock-");
    const lockPath = join(directory, "owner.sqlite");
    const environment = { ...process.env, CEDIA_SESSION_LOCK: lockPath };
    const holder = spawn(fixtureNode, [lockFixture], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    await waitForOutput(holder, /LOCKED/);

    const contender = spawn(fixtureNode, [lockFixture], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    const contenderOutput = await waitForOutput(contender, /still owned|LOCKED/);
    const contenderExit = await waitForExit(contender);
    expect(contenderOutput).toMatch(/still owned/);
    expect(contenderExit.code).toBe(73);

    holder.kill("SIGKILL");
    await waitForExit(holder);
    const afterCrash = spawn(fixtureNode, [lockFixture], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    await waitForOutput(afterCrash, /LOCKED/);
    afterCrash.kill("SIGKILL");
    await waitForExit(afterCrash);
  });
});


it("binds native permission options and exact arguments before returning a structured OMP decision", async () => {
  const fixture = makeHost("native-permission");
  const session = await fixture.host.startSession(fixture.sessionId);
  await fixture.host.command(session.id, "owner", { commandId: "permission-prompt", incarnation: session.incarnation, command: "prompt", payload: { message: "fixture" } });
  await waitFor(() => fixture.host.pendingUi(session.id).length > 0);
  const pending = fixture.host.pendingUi(session.id)[0] as { token: string; request: { method: string } };
  expect(pending.request.method).toBe("select");
  expect(fixture.store.readEvents(session.id).events.some(event => JSON.stringify(event.frame).includes('printf fixture'))).toBe(true);
  await fixture.host.respond(session.id, "owner", { commandId: "permission-answer", incarnation: session.incarnation, token: pending.token, answer: "1. Allow once" });
  await waitFor(() => fixture.store.readEvents(session.id).events.some(event => event.frame && typeof event.frame === "object" && !Array.isArray(event.frame) && event.frame.type === "fixture_permission_outcome"));
  const outcome = fixture.store.readEvents(session.id).events.find(event => event.frame && typeof event.frame === "object" && !Array.isArray(event.frame) && event.frame.type === "fixture_permission_outcome");
  expect(outcome?.frame).toMatchObject({ outcome: { outcome: "selected", optionId: "allow_once", kind: "allow_once" } });
  await expect(fixture.host.respond(session.id, "owner", { commandId: "stale-answer", incarnation: session.incarnation, token: pending.token, answer: "1. Allow once" })).resolves.toMatchObject({ status: "not_dispatched" });
});

describe("OMP runtime version gate", () => {
  /**
   * The gate exists so a task can never be started on a runtime the adapter contract
   * was not written against. A later patch of the baseline's minor line is the case a
   * developer machine actually hits: refusing it made the composer fail at startSession
   * before any prompt was sent.
   */
  function hostWithOmpVersion(version: string): { host: CediaHost; sessionId: string; store: DurableStore } {
    const directory = temporaryDirectory("cedia-host-omp-version-");
    const projectPath = join(directory, "project");
    mkdirSync(projectPath, { recursive: true });
    const store = DurableStore.open({ stateDir: directory, recover: false });
    const project = store.createProject({ path: projectPath, name: "Version gate project" });
    const host = new CediaHost({
      store,
      stateDir: directory,
      ompExecutable: fixture,
      ompEnv: { CEDIA_NODE: fixtureNode, CEDIA_FAKE_HOST_MODE: "normal", CEDIA_FAKE_OMP_VERSION: version },
    });
    const session = host.createSession(project.id, "Version gate task");
    return { host, sessionId: session.id, store };
  }

  it("starts a session on a later patch of the supported line", async () => {
    const fixtureHost = hostWithOmpVersion("omp/18.1.22");
    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    expect(started.status).toBe("idle");
    await fixtureHost.host.stopSession(fixtureHost.sessionId);
  });

  it("runs on a newer minor line instead of refusing its number", async () => {
    // The baseline is a floor, not a pin: this project's machine moved to 18.2.1 while the
    // contract was written at 18.1.18, and what a runtime supports is read from its ready
    // frame (the Cedia bridges are capability-gated there) rather than from its version.
    const fixtureHost = hostWithOmpVersion("omp/18.2.1");
    const started = await fixtureHost.host.startSession(fixtureHost.sessionId);
    expect(started.status).toBe("idle");
    await fixtureHost.host.stopSession(fixtureHost.sessionId);
  });

  it("refuses a runtime older than the baseline, naming what it expects", async () => {
    const fixtureHost = hostWithOmpVersion("omp/18.1.17");
    await expect(fixtureHost.host.startSession(fixtureHost.sessionId)).rejects.toMatchObject({
      code: "unsupported_omp",
      message: expect.stringContaining("18.1.18 or later"),
    });
    // Nothing ran: the gate refuses before the session is mutated, so it stays idle.
    expect(fixtureHost.store.getSession(fixtureHost.sessionId)?.status).toBe("idle");
  });

  it("refuses output that is not an OMP version at all", async () => {
    const fixtureHost = hostWithOmpVersion("not-an-omp");
    await expect(fixtureHost.host.startSession(fixtureHost.sessionId)).rejects.toMatchObject({ code: "unsupported_omp" });
  });
});
