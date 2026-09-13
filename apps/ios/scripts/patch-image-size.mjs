/** Local bounds backport for the pinned Metro image-size parser; fails on upstream drift. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("image-size/package.json"));
if (JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version !== "1.2.1") throw new Error("Review image-size bounds backport for the new version");
const patches = [
  { file: "icns.js", sha: "5e6a097fca237b0bb3b68a1be920e39a3846c0018d8917658b5ed88590a710e8", before: "    const imageLengthOffset = imageOffset + ENTRY_LENGTH_OFFSET;", after: `    // Caret bounds backport: every ICNS entry must advance past its header.
    if (imageOffset < 8 || imageOffset + 8 > input.length) throw new TypeError('Invalid ICNS entry header');
    const entryLength = (0, utils_1.readUInt32BE)(input, imageOffset + ENTRY_LENGTH_OFFSET);
    const declaredLength = (0, utils_1.readUInt32BE)(input, FILE_LENGTH_OFFSET);
    if (entryLength < 8 || imageOffset + entryLength > declaredLength) throw new TypeError('Invalid ICNS entry length');
    const imageLengthOffset = imageOffset + ENTRY_LENGTH_OFFSET;` },
  { file: "utils.js", sha: "e9faf86abcc962a5fc2488a4c3c9d8dc915aa22a0dd6a7bad6556cd9a326c349", before: `    if (input.length - offset < 4)
        return;
    const boxSize = (0, exports.readUInt32BE)(input, offset);`, after: `    // Caret bounds backport: box size zero extends to EOF; every box advances.
    if (!Number.isSafeInteger(offset) || offset < 0 || input.length - offset < 8)
        return;
    const declaredSize = (0, exports.readUInt32BE)(input, offset);
    const boxSize = declaredSize === 0 ? input.length - offset : declaredSize;
    if (boxSize < 8) throw new TypeError('Invalid image container box size');` },
];
for (const patch of patches) {
  const path = join(root, "dist/types", patch.file);
  const content = readFileSync(path, "utf8");
  // Verify the whole original text even on a repeated invocation.
  const original = content.includes(patch.after) ? content.replace(patch.after, patch.before) : content;
  if (createHash("sha256").update(original).digest("hex") !== patch.sha) throw new Error(`Unexpected image-size source: ${patch.file}`);
  if (content === original) writeFileSync(path, original.replace(patch.before, patch.after));
}
console.log("Verified image-size 1.2.1 local container bounds backport");
