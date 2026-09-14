import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, normalize, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const desktop = join(root, "desktop");
const manifest = JSON.parse(readFileSync(join(root, "patches/desktop/manifest.json"), "utf8"));

if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: desktop, encoding: "utf8" }).trim() !== manifest.baseRevision)
  throw new Error("Code-OSS base differs from the reviewed Caret pin");

for (const entry of manifest.patches as { file: string; sha256: string }[]) {
  const patch = join(root, "patches/desktop", entry.file);
  if (createHash("sha256").update(readFileSync(patch)).digest("hex") !== entry.sha256)
    throw new Error(`Caret desktop patch integrity mismatch: ${entry.file}`);
  try {
    execFileSync("git", ["apply", "--reverse", "--check", patch], { cwd: desktop, stdio: "pipe" });
    continue; // Already applied; a re-run must not fail or double-apply.
  } catch {
    execFileSync("git", ["apply", "--check", patch], { cwd: desktop, stdio: "inherit" });
    execFileSync("git", ["apply", patch], { cwd: desktop, stdio: "inherit" });
  }
}

// Whole trees and files that Caret does not ship — the Copilot/Claude/Codex
// harness layer, its tests, and the Copilot-schema pickers — are recorded as
// removals instead of a multi-megabyte deletion patch, so every removal is
// reviewable in one list. Each path must stay inside the pinned checkout.
for (const entry of (manifest.removals ?? []) as string[]) {
  const target = normalize(join(desktop, entry));
  if (target !== desktop && !target.startsWith(desktop + sep)) throw new Error(`Removal escapes the checkout: ${entry}`);
  await rm(target, { recursive: true, force: true });
}

console.log(`Caret desktop patches applied (${manifest.patches.length} patches, ${(manifest.removals ?? []).length} removals)`);
