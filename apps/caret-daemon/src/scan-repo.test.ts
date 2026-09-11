import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanRepoTexts } from "./scan-repo.ts";

const dirs: string[] = [];
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caret-scan-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("ScanRepo", () => {
  it("skips ignored files and records per-file failures", async () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, ".caretignore"), "secret.ts\n");
    fs.writeFileSync(path.join(root, "ok.ts"), "export const ok = 1\n");
    fs.writeFileSync(path.join(root, "secret.ts"), "export const secret = 1\n");
    fs.writeFileSync(path.join(root, "big.ts"), "x".repeat(70_000));
    const scan = scanRepoTexts(root);
    expect(scan.files.map((f) => f.path)).toEqual(["ok.ts"]);
    expect(scan.skippedIgnored).toBeGreaterThan(0);
    expect(scan.failures.some((f) => f.path === "big.ts" && f.reason === "too-large")).toBe(true);
  });
});
