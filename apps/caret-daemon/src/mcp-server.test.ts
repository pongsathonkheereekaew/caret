// Caret tool-server conformance: OUR stdio client drives OUR tool server
// end to end (initialize, list, exec success/failure/timeout, fetch
// guardsuite, unknown tool). Fetch guards never touch the network; live
// fetch stays a manual probe (no external dependency in the suite).
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

import { McpClient, McpError } from "./mcp.ts";

const SERVER = path.join(import.meta.dirname, "mcp-server.ts");

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
  throw new Error("bun runtime not found for MCP server");
}

describe("McpToolServer", () => {
  let client: McpClient | null = null;

  const boot = async () => {
    if (client) return client;
    const next = new McpClient(bunBinary(), ["run", SERVER]);
    const hello = await next.start(15000);
    expect(hello.protocolVersion).toBe("2024-11-05");
    expect(hello.server).toBe("caret-tools");
    client = next;
    return next;
  };

  afterAll(async () => {
    await client?.close();
    client = null;
  });

  it("lists caret tools", async () => {
    const c = await boot();
    expect((await c.listTools()).map((t) => t.name).sort()).toEqual(["test_run", "web_fetch"]);
  });

  it("runs commands with exit reporting and timeout", async () => {
    const c = await boot();
    const ok = await c.callTool("test_run", { command: "echo", args: ["tool-hello"] });
    expect(ok.isError).toBeUndefined();
    expect(ok.content[0]?.text).toContain("tool-hello");
    expect(ok.content[0]?.text).toContain("exit=0");
    const failed = await c.callTool("test_run", { command: "false", args: [] });
    expect(failed.isError).toBe(true);
    expect(failed.content[0]?.text).toContain("exit=1");
    const node = process.execPath;
    const slow = await c.callTool(
      "test_run",
      { command: node, args: ["-e", "setTimeout(()=>{},30000)"], timeoutMs: 400 },
      10000,
    );
    expect(slow.isError).toBe(true);
    expect(slow.content[0]?.text).toContain("timed out");
    await expect(c.callTool("test_run", {})).rejects.toThrow(McpError);
  });

  it("refuses fetch abuse without touching the network", async () => {
    const c = await boot();
    await expect(c.callTool("web_fetch", {})).rejects.toThrow(/needs url/);
    await expect(c.callTool("web_fetch", { url: "ftp://x/y" })).rejects.toThrow(/http\(s\) only/);
    await expect(c.callTool("web_fetch", { url: "http://localhost:9/x" })).rejects.toThrow(/refused/);
    await expect(c.callTool("web_fetch", { url: "http://169.254.169.254/x" })).rejects.toThrow(/refused/);
    await expect(c.callTool("web_fetch", { url: "https://user:pw@example.com/" })).rejects.toThrow(/credentials/);
    await expect(c.callTool("nope", {})).rejects.toThrow(McpError);
  });
});
