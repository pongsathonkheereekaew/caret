// Forge client conformance (M10 seed): repo create/read, PR lifecycle
// open→read→list→merge→merged, auth and missing-resource errors — against
// the Gitea-shaped stub. No mocks; the peer speaks real HTTP + JSON.
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import * as cp from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GiteaClient, ForgeError } from "./forge.ts";

const FIXTURE = path.join(import.meta.dirname, "forge-fixture-server.ts");
const PORT = 18931;

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
  throw new Error("bun runtime not found for forge fixture");
}

describe("ForgeClient", () => {
  let proc: cp.ChildProcess | null = null;

  const client = (token = "forge-test-token") => new GiteaClient(`http://127.0.0.1:${PORT}`, token);

  beforeAll(async () => {
    proc = cp.spawn(bunBinary(), ["run", FIXTURE, "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("forge fixture never listened")), 15000);
      proc?.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString("utf8").includes(`listening ${PORT}`)) {
          clearTimeout(timer);
          resolve();
        }
      });
      proc?.on("error", reject);
    });
  }, 30000);

  afterAll(() => {
    proc?.kill();
    proc = null;
  });

  it("creates and reads a repo", async () => {
    const created = await client().createRepo("proof-repo");
    expect(created.fullName).toBe("caret/proof-repo");
    expect(created.defaultBranch).toBe("main");
    const read = await client().getRepo("caret", "proof-repo");
    expect(read.fullName).toBe("caret/proof-repo");
  });

  it("runs the PR lifecycle to merged", async () => {
    const c = client();
    const opened = await c.createPull("caret", "proof-repo", { title: "add thing", head: "feature", base: "main" });
    expect(opened.state).toBe("open");
    expect(opened.merged).toBe(false);
    expect(opened.headRef).toContain("feature");
    const read = await c.getPull("caret", "proof-repo", opened.number);
    expect(read.title).toBe("add thing");
    const open = await c.listPulls("caret", "proof-repo", "open");
    expect(open.map((p) => p.number)).toContain(opened.number);
    const merged = await c.mergePull("caret", "proof-repo", opened.number);
    expect(merged.merged).toBe(true);
    expect(merged.state).toBe("closed");
    expect(await c.listPulls("caret", "proof-repo", "open")).toEqual([]);
  });

  it("surfaces auth and missing-resource errors", async () => {
    await expect(client("wrong-token").getRepo("caret", "proof-repo")).rejects.toThrow(/unauthorized/);
    await expect(client().getRepo("caret", "nope")).rejects.toThrow(/not found/);
    await expect(client().getPull("caret", "proof-repo", 999)).rejects.toThrow(/not found/);
    await expect(client().createRepo("")).rejects.toThrow(ForgeError);
  });
});
