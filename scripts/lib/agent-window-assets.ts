import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** One receipt for the actual frontend, its assets and the native host bridge. */
export function agentWindowDigest(root: string): string | undefined {
  try {
    if (!statSync(join(root, "index.html")).isFile() || !statSync(join(root, "main.cjs")).isFile()) return undefined;
    const files: string[] = [];
    function walk(relative: string): void {
      for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
        const path = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile()) files.push(path);
        else throw new Error("Unexpected non-file in Agent Window assets");
      }
    }
    walk("");
    const hash = createHash("sha256");
    for (const path of files.sort()) {
      hash.update(path).update("\0").update(createHash("sha256").update(readFileSync(join(root, path))).digest()).update("\0");
    }
    return hash.digest("hex");
  } catch { return undefined; }
}
