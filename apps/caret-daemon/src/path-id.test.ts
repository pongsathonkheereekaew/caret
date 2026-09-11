import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canonRoot } from "./path-id.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("canonRoot", () => {
  it("collapses a symlink to the same identity as the real path", () => {
    const real = fs.mkdtempSync(path.join(os.tmpdir(), "caret-real-"));
    dirs.push(real);
    const link = path.join(os.tmpdir(), `caret-link-${Date.now()}`);
    fs.symlinkSync(real, link);
    dirs.push(link);
    expect(canonRoot(link)).toBe(canonRoot(real));
  });
});
