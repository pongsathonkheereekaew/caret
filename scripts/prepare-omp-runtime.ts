import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildOmpNative } from "./lib/omp-native-build.ts";
import { OMP_BASELINE_VERSION } from "../packages/omp-adapter/src/types.ts";
import { verifyOmpSource, launcherText, fileSha256, attestOmpRuntime } from "./lib/omp-runtime-integrity.ts";

const root = resolve(import.meta.dir, "..");
const manifestPath = join(root, "patches/omp/manifest.json");
if (!existsSync(manifestPath)) throw new Error("OMP patch manifest is not finalized yet");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { revision: string; patches: { file: string; sha256: string }[] };
if (manifest.patches.length !== 1) throw new Error("Use one consolidated patch per pinned runtime revision");
const source = join(root, "upstream/omp");
const run = (command: string, args: string[], cwd = root) => execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (!existsSync(join(source, ".git"))) {
  mkdirSync(dirname(source), { recursive: true });
  run("git", ["clone", "--no-checkout", "https://github.com/can1357/oh-my-pi", source]);
  run("git", ["checkout", "--detach", manifest.revision], source);
}
if (run("git", ["rev-parse", "HEAD"], source).trim() !== manifest.revision) throw new Error("OMP source revision differs from the patch manifest");
for (const patch of manifest.patches) {
  if (!/^[a-zA-Z0-9_.-]+\.patch$/.test(patch.file)) throw new Error("Invalid patch path");
  const path = join(root, "patches/omp", patch.file);
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== patch.sha256) throw new Error(`Patch integrity failure: ${patch.file}`);
  let applied = false;
  try { run("git", ["apply", "--reverse", "--check", path], source); applied = true; } catch { /* expected for a clean baseline */ }
  if (!applied) { run("git", ["apply", "--check", path], source); run("git", ["apply", path], source); }
}
const sourceTree = verifyOmpSource(root, source, manifest);
run(process.execPath, ["install", "--frozen-lockfile", "--ignore-scripts"], source);
// Native edit overlays are part of the pinned patch and require its rebuilt addon.
const nativeTarget = buildOmpNative(source, sourceTree);
run(process.execPath, ["packages/collab-web/scripts/build-tool-views.ts"], source);
const cli = join(source, "packages/coding-agent/src/cli.ts");
// The shipped runtime is the baseline exactly: this script builds it from the pinned
// source, so a different version means the pin moved and the manifest has to move with it.
if (run(process.execPath, [cli, "--version"], source).trim() !== `omp/${OMP_BASELINE_VERSION}`) throw new Error("Prepared OMP version check failed");
const standalone = process.argv.includes("--standalone");
const output = join(root, standalone ? "dist/omp-standalone/omp" : "dist/omp/omp");
mkdirSync(dirname(output), { recursive: true });
let reuseStandalone = false;
if (standalone && existsSync(output)) {
  try { reuseStandalone = attestOmpRuntime(root, output).runtimeKind === "standalone-binary"; } catch { /* Rebuild stale or unverified output. */ }
}
if (standalone && !reuseStandalone) {
  execFileSync(process.execPath, ["packages/coding-agent/scripts/build-binary.ts"], { cwd: source,
    env: { ...process.env, CEDIA_COMPILED_RUNTIME: "1", PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}` }, stdio: "inherit" });
  copyFileSync(join(source, "packages/coding-agent/dist/omp"), output);
} else if (!standalone) writeFileSync(output, launcherText(process.execPath, source), { mode: 0o755 });
chmodSync(output, 0o755);
if (verifyOmpSource(root, source, manifest) !== sourceTree) throw new Error("OMP source changed during preparation");
if (standalone && run(output, ["--version"], root).trim() !== `omp/${OMP_BASELINE_VERSION}`) throw new Error("Standalone OMP version check failed");
writeFileSync(join(dirname(output), "runtime.json"), JSON.stringify({ revision: manifest.revision, patches: manifest.patches, source, sourceTree, executable: output, executableSha256: fileSha256(output), bun: process.execPath, bunSha256: fileSha256(process.execPath), nativePath: nativeTarget, nativeSha256: fileSha256(nativeTarget), developmentRuntime: !standalone, standaloneRuntime: standalone }, null, 2) + "\n");
console.log(`Prepared pinned Cedia OMP ${standalone ? "standalone" : "development"} runtime: ${output}`);
