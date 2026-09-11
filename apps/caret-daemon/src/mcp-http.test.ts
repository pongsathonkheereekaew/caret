// MCP streamable-HTTP conformance (PX-14 tail): initialize over SSE with
// session ids, JSON + SSE responses, tool errors, cancellation, timeout,
// reconnect, transparent session recovery, bearer-auth seam — against the
// HTTP fixture. No mocks; the peer speaks real HTTP + SSE.
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import * as cp from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { McpHttpClient } from "./mcp-http.ts";
import { McpError } from "./mcp.ts";

const FIXTURE = path.join(import.meta.dirname, "mcp-http-fixture-server.ts");
const PORT = 18923;
const AUTH_PORT = 18924;

// Duplicated from mcp.test.ts: the two harnesses stay independently
// runnable with no cross-test imports.
function bunBinary(): string {
  const candidates = [
    process.env["CARET_BUN"],
    path.join(os.homedir(), ".bun", "bin", "bun"),
    "bun",
  ].filter((c): c is string => !!c);
  for (const candidate of candidates) {
    try {
      if (candidate === "bun" || fs.existsSync(candidate)) return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("bun runtime not found for MCP fixture");
}

function serve(port: number, extraArgs: string[] = []): Promise<cp.ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = cp.spawn(bunBinary(), ["run", FIXTURE, "--port", String(port), ...extraArgs], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => reject(new Error(`fixture ${port} never listened`)), 15000);
    proc.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString("utf8").includes(`listening ${port}`)) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.on("error", reject);
  });
}

describe("McpHttpTransport", () => {
  let plain: cp.ChildProcess | null = null;
  let gated: cp.ChildProcess | null = null;
  let client: McpHttpClient | null = null;

  const boot = async (port = PORT, auth?: { token: () => string | undefined }) => {
    const next = new McpHttpClient(`http://127.0.0.1:${port}/mcp`, auth);
    const hello = await next.start(10000);
    expect(hello.protocolVersion).toBe("2024-11-05");
    expect(hello.server).toBe("caret-fixture-http");
    expect(next.session).toMatch(/^s-\d+$/);
    client = next;
    return next;
  };

  beforeAll(async () => {
    plain = await serve(PORT);
    gated = await serve(AUTH_PORT, ["--require-auth"]);
  }, 30000);

  afterAll(async () => {
    await client?.close().catch(() => {});
    client = null;
    plain?.kill();
    gated?.kill();
  });

  it("initializes over SSE and lists/pings over JSON", async () => {
    const c = await boot();
    const tools = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["ask", "echo", "fail", "sleep"]);
    await c.ping();
  });

  it("calls echo over SSE and surfaces tool errors", async () => {
    const c = client ?? (await boot());
    const ok = await c.callTool("echo", { text: "hello-http" });
    expect(ok.isError).toBeUndefined();
    expect(ok.content[0]?.text).toBe("hello-http");
    const failed = await c.callTool("fail", {});
    expect(failed.isError).toBe(true);
  });

  it("lists and reads resources", async () => {
    const c = client ?? (await boot());
    const resources = await c.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([
      "caret://config/snippet",
      "caret://notes/welcome",
    ]);
    const contents = await c.readResource("caret://config/snippet");
    expect(contents[0]?.text).toBe(`{"tab":"single-line"}`);
    await expect(c.readResource("caret://nope")).rejects.toThrow(/unknown resource/);
  });

  it("lists and gets prompts", async () => {
    const c = client ?? (await boot());
    const prompts = await c.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["review", "summarize"]);
    const review = await c.getPrompt("review", { diff: "a-b" });
    expect(review.messages[0]?.content.text).toBe("review this: a-b");
    await expect(c.getPrompt("nope")).rejects.toThrow(/unknown prompt/);
  });

  it("reports ask as unsupported over HTTP (no event stream)", async () => {
    const c = client ?? (await boot());
    const failed = await c.callTool("ask", {});
    expect(failed.isError).toBe(true);
    expect(failed.content[0]?.text).toMatch(/stream/);
  });

  it("elicits with an accept handler through the GET stream", { timeout: 15000 }, async () => {
    const next = new McpHttpClient(`http://127.0.0.1:${PORT}/mcp`, undefined, {
      onElicitation: async (params) => {
        expect(params.message).toBe("What is your name?");
        return { action: "accept", content: { name: "bob" } };
      },
    });
    await next.start(10000);
    try {
      const ok = await next.callTool("ask", {});
      expect(ok.isError).toBeUndefined();
      expect(ok.content[0]?.text).toBe("hello bob");
    } finally {
      await next.close();
    }
  });

  it("surfaces decline over the GET stream as a tool-level error", { timeout: 15000 }, async () => {
    const next = new McpHttpClient(`http://127.0.0.1:${PORT}/mcp`, undefined, {
      onElicitation: async () => ({ action: "decline" }),
    });
    await next.start(10000);
    try {
      const failed = await next.callTool("ask", {});
      expect(failed.isError).toBe(true);
      expect(failed.content[0]?.text).toBe("elicitation declined");
    } finally {
      await next.close();
    }
  });

  it("opens the GET stream on the gated peer with a bearer token", { timeout: 15000 }, async () => {
    const next = new McpHttpClient(
      `http://127.0.0.1:${AUTH_PORT}/mcp`,
      { token: () => "test-token" },
      { onElicitation: async () => ({ action: "accept", content: { name: "ann" } }) },
    );
    await next.start(10000);
    try {
      const ok = await next.callTool("ask", {});
      expect(ok.content[0]?.text).toBe("hello ann");
    } finally {
      await next.close();
    }
  });

  it("rejects unknown tools with protocol errors", async () => {
    const c = client ?? (await boot());
    await expect(c.callTool("nope", {})).rejects.toThrow(McpError);
  });

  it("cancels a long call through notifications", async () => {
    const c = client ?? (await boot());
    const { id, done } = c.rawRequest("tools/call", { name: "sleep", arguments: { ms: 8000 } }, 20000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await c.cancelCall(id);
    const result = (await done) as { content?: Array<{ text?: string }>; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toBe("cancelled");
  });

  it("times out a slow call locally", async () => {
    const c = client ?? (await boot());
    await expect(c.callTool("sleep", { ms: 8000 }, 300)).rejects.toThrow(/timed out/);
  });

  it("reconnects after session delete with a fresh id", async () => {
    const c = client ?? (await boot());
    const before = c.session;
    await c.reconnect();
    expect(c.session).not.toBe(before);
    const ok = await c.callTool("echo", { text: "back" });
    expect(ok.content[0]?.text).toBe("back");
  });

  it("recovers transparently when the server drops the session", async () => {
    const c = client ?? (await boot());
    await fetch(`http://127.0.0.1:${PORT}/test/drop`, { method: "POST" });
    const ok = await c.callTool("echo", { text: "recovered" });
    expect(ok.content[0]?.text).toBe("recovered");
  });

  it("refuses without a token and passes with one on the gated peer", async () => {
    const bare = new McpHttpClient(`http://127.0.0.1:${AUTH_PORT}/mcp`);
    await expect(bare.start(10000)).rejects.toThrow(/unauthorized|401/);
    const authed = await boot(AUTH_PORT, { token: () => "test-token" });
    const ok = await authed.callTool("echo", { text: "authed" });
    expect(ok.content[0]?.text).toBe("authed");
    await authed.close();
    client = null;
  });
});
