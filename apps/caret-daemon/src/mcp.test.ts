// MCP transport conformance (PX-14 core): initialize, list, call, errors,
// cancellation, timeout, reconnect — against the fixture server. No mocks;
// the peer speaks real newline-delimited JSON-RPC over stdio.
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

import { McpClient, McpError } from "./mcp.ts";

const FIXTURE = path.join(import.meta.dirname, "mcp-fixture-server.ts");

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

describe("McpTransport", () => {
  let client: McpClient | null = null;

  const boot = async () => {
    const next = new McpClient(bunBinary(), ["run", FIXTURE]);
    const hello = await next.start(10000);
    expect(hello.protocolVersion).toBe("2024-11-05");
    expect(hello.server).toBe("caret-fixture");
    client = next;
    return next;
  };

  afterAll(async () => {
    await client?.close();
    client = null;
  });

  it("initializes and lists tools", async () => {
    const c = await boot();
    const tools = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["ask", "echo", "fail", "sleep"]);
    await c.ping();
  });

  it("calls echo and surfaces tool errors", async () => {
    const c = client ?? (await boot());
    const ok = await c.callTool("echo", { text: "hello-mcp" });
    expect(ok.isError).toBeUndefined();
    expect(ok.content[0]?.text).toBe("hello-mcp");
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
    const contents = await c.readResource("caret://notes/welcome");
    expect(contents[0]?.text).toBe("welcome to the caret fixture");
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

  it("elicits with an accept handler through the ask tool", async () => {
    const next = new McpClient(bunBinary(), ["run", FIXTURE]);
    next.setElicitationHandler(async (params) => {
      expect(params.message).toBe("What is your name?");
      return { action: "accept", content: { name: "bob" } };
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

  it("fails the ask tool cleanly with no elicitation handler", async () => {
    const next = new McpClient(bunBinary(), ["run", FIXTURE]);
    await next.start(10000);
    try {
      const failed = await next.callTool("ask", {});
      expect(failed.isError).toBe(true);
      expect(failed.content[0]?.text).toMatch(/elicitation/);
    } finally {
      await next.close();
    }
  });

  it("rejects unknown tools with protocol errors", async () => {
    const c = client ?? (await boot());
    await expect(c.callTool("nope", {})).rejects.toThrow(McpError);
  });

  it("cancels a long call and times out cleanly", async () => {
    const c = client ?? (await boot());
    const { id, done } = c.rawRequest("tools/call", { name: "sleep", arguments: { ms: 4000 } }, 20000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await c.cancelCall(id);
    const result = (await done) as { content?: Array<{ text?: string }>; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toBe("cancelled");
  });

  it("reconnects after kill and works again", async () => {
    const c = client ?? (await boot());
    await c.reconnect();
    const tools = await c.listTools();
    expect(tools.length).toBe(4);
    const ok = await c.callTool("echo", { text: "back" });
    expect(ok.content[0]?.text).toBe("back");
  });
});
