// Process host conformance: spawn readiness, distinct endpoints+tokens,
// list/stop semantics, unknown-stop refusal, failed spawn cleanup —
// against the fixture daemon. No engine.
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { ProcessHost, HostError } from "./process-host.ts";

const FIXTURE = path.join(import.meta.dirname, "host-fixture-server.ts");

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
  throw new Error("bun runtime not found for host fixture");
}

describe("ProcessHost", () => {
  const hosts: ProcessHost[] = [];
  const makeHost = () => {
    const host = new ProcessHost(
      { command: bunBinary(), args: ["run", FIXTURE], cwd: path.dirname(FIXTURE) },
      15000,
    );
    hosts.push(host);
    return host;
  };

  afterEach(async () => {
    for (const host of hosts.splice(0)) {
      await host.shutdownAll();
    }
  });

  it("spawns isolated endpoints with unique tokens", async () => {
    const host = makeHost();
    const a = await host.spawn("/tmp/repo-a", "run-a");
    const b = await host.spawn("/tmp/repo-b", "run-b");
    expect(a.port).not.toBe(b.port);
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.id.startsWith("run-a-")).toBe(true);
    expect(typeof a.pid).toBe("number");
    expect(host.list().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("stops one session and refuses the unknown", async () => {
    const host = makeHost();
    const a = await host.spawn("/tmp/repo-a", "run-a");
    const pid = a.pid as number;
    await host.stop(a.id, 3000);
    expect(host.list()).toEqual([]);
    expect(() => process.kill(pid, 0)).toThrow();
    await expect(host.stop(a.id)).rejects.toThrow(HostError);
    await expect(host.stop("nope")).rejects.toThrow(/unknown session/);
  });

  it("fails fast when the daemon never becomes ready", async () => {
    const host = new ProcessHost({ command: "/nonexistent-binary-xyz", args: [], cwd: "/tmp" }, 3000);
    hosts.push(host);
    await expect(host.spawn("/tmp/r", "run-x")).rejects.toThrow();
    expect(host.list()).toEqual([]);
  });
});
