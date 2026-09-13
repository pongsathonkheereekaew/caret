import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dir, "..");
const desktop = join(root, "desktop");
const manifest = JSON.parse(readFileSync(join(root, "patches/desktop/manifest.json"), "utf8"));
const patch = join(root, "patches/desktop", manifest.patch);
if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: desktop, encoding: "utf8" }).trim() !== manifest.baseRevision)
  throw new Error("Code-OSS base differs from the reviewed Caret pin");
if (createHash("sha256").update(readFileSync(patch)).digest("hex") !== manifest.sha256)
  throw new Error("Caret desktop patch integrity mismatch");
try {
  execFileSync("git", ["apply", "--reverse", "--check", patch], { cwd: desktop, stdio: "pipe" });
} catch {
  execFileSync("git", ["apply", "--check", patch], { cwd: desktop, stdio: "inherit" });
  execFileSync("git", ["apply", patch], { cwd: desktop, stdio: "inherit" });
}
console.log("Caret desktop startup defaults applied to pinned Code-OSS");
