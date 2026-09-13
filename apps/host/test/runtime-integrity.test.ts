import { nativeArtifactFromCargo } from "../../../scripts/lib/omp-native-build.ts";
import { test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileSha256, verifyOmpSource } from "../../../scripts/lib/omp-runtime-integrity.ts";

test("runtime attestation rejects extra source changes without changing the real index", () => {
  const root = mkdtempSync(join(tmpdir(), "caret-runtime-integrity-test-"));
  const source = join(root, "source"); mkdirSync(source);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: source, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init"); git("config", "user.email", "fixture@invalid"); git("config", "user.name", "Fixture");
    writeFileSync(join(source, "entry.ts"), "export const value = 1;\n");
    git("add", "."); git("commit", "-m", "fixture baseline");
    const revision = git("rev-parse", "HEAD");
    writeFileSync(join(source, "entry.ts"), "export const value = 2;\n");
    const patchDirectory = join(root, "patches/omp"); mkdirSync(patchDirectory, { recursive: true });
    const patchPath = join(patchDirectory, "fixture.patch");
    writeFileSync(patchPath, git("diff", "--binary") + "\n");
    const manifest = { revision, patches: [{ file: "fixture.patch", sha256: fileSha256(patchPath) }] };
    const index = readFileSync(join(source, ".git/index"));
    expect(verifyOmpSource(root, source, manifest)).toMatch(/^[a-f0-9]{40}$/);
    expect(readFileSync(join(source, ".git/index"))).toEqual(index);
    writeFileSync(join(source, "extra.ts"), "unrecorded source\n");
    expect(() => verifyOmpSource(root, source, manifest)).toThrow("outside the recorded patch");
    expect(readFileSync(join(source, ".git/index"))).toEqual(index);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("selects Cargo's reported native artifact instead of a stale default target directory", () => {
  const frame = { reason: "compiler-artifact", target: { name: "pi_natives", kind: ["cdylib"] }, filenames: ["/redirected/target/debug/libpi_natives.dylib"] };
  expect(nativeArtifactFromCargo(JSON.stringify(frame) + "\n")).toBe("/redirected/target/debug/libpi_natives.dylib");
  expect(() => nativeArtifactFromCargo(JSON.stringify({ reason: "build-finished", success: true }))).toThrow(/exactly one/);
});
