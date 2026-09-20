import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, normalize, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const desktop = join(root, "desktop");
const manifest = JSON.parse(readFileSync(join(root, "patches/desktop/manifest.json"), "utf8"));

if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: desktop, encoding: "utf8" }).trim() !== manifest.baseRevision)
  throw new Error("Code-OSS base differs from the reviewed Cedia pin");

// Patch sets overlap: a later patch may rewrite lines an earlier patch added
// (0011's model-picker block was extended by 0043/0045), so per-patch
// reverse-check cannot prove "already applied" for every patch once the whole
// set is on. The stamp proves the whole set instead: it is written only after
// a full successful apply, and `git clean` on reset deletes it, so a reset
// always re-prepares. Drift inside the checkout is caught by the
// desktop-patch-set test's mirror comparison, not here.
const manifestDigest = createHash("sha256").update(JSON.stringify([
  manifest.baseRevision,
  manifest.patches.map((patch: { file: string; sha256: string }) => [patch.file, patch.sha256]),
])).digest("hex");
const stampPath = join(desktop, ".prepared.json");
try {
  const stamp = JSON.parse(readFileSync(stampPath, "utf8")) as { manifestDigest?: string };
  if (stamp.manifestDigest === manifestDigest) {
    console.log(`Cedia desktop patches already prepared (${manifest.patches.length} patches, ${(manifest.removals ?? []).length} removals)`);
    process.exit(0);
  }
} catch { /* Missing or stale stamp: run the per-patch loop below. */ }

for (const entry of manifest.patches as { file: string; sha256: string }[]) {
  const patch = join(root, "patches/desktop", entry.file);
  if (createHash("sha256").update(readFileSync(patch)).digest("hex") !== entry.sha256)
    throw new Error(`Cedia desktop patch integrity mismatch: ${entry.file}`);
  try {
    execFileSync("git", ["apply", "--reverse", "--check", patch], { cwd: desktop, stdio: "pipe" });
    continue; // Already applied; a re-run must not fail or double-apply.
  } catch {
    execFileSync("git", ["apply", "--check", patch], { cwd: desktop, stdio: "inherit" });
    execFileSync("git", ["apply", patch], { cwd: desktop, stdio: "inherit" });
  }
}

// Whole trees and files that Cedia does not ship — the Copilot/Claude/Codex
// harness layer, its tests, and the Copilot-schema pickers — are recorded as
// removals instead of a multi-megabyte deletion patch, so every removal is
// reviewable in one list. Each path must stay inside the pinned checkout.
for (const entry of (manifest.removals ?? []) as string[]) {
  const target = normalize(join(desktop, entry));
  if (target !== desktop && !target.startsWith(desktop + sep)) throw new Error(`Removal escapes the checkout: ${entry}`);
  await rm(target, { recursive: true, force: true });
}

console.log(`Cedia desktop patches applied (${manifest.patches.length} patches, ${(manifest.removals ?? []).length} removals)`);
writeFileSync(stampPath, JSON.stringify({ manifestDigest, appliedAt: new Date().toISOString() }) + "\n");
