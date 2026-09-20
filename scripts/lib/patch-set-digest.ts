/** Identity of the desktop patch set that built the packaged Cedia shell.
 *
 * Why this exists: the packaged `product.json` used to prove only which upstream
 * revision was pinned, never which patch set the app was actually built from. The
 * rendered shell lives in bundles the patches edit (`patches/desktop/*.patch`), and a
 * package made before a patch landed keeps the old bundles while every other receipt
 * still reads as current - the exact stale-shell situation this digest is meant to
 * catch. Hashing the manifest's base revision plus every patch file's recorded sha256
 * gives one value a package can carry, and `scripts/check-packaged-shell.ts` can
 * recompute it from the repository.
 *
 * The digest is deterministic and order-sensitive, and it reads no timestamps: only
 * `packagedAt` in `product.json` records when a build happened. A patch's mtime is
 * used solely for the freshness gate, because content is what the digest proves.
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PATCH_DIR = join("patches", "desktop");
const PATCH_MANIFEST = "manifest.json";

export interface PatchSetManifest {
	readonly baseRevision: string;
	readonly patches: readonly { readonly file: string; readonly sha256: string }[];
}

/** sha256 hex over baseRevision + every patch's file/sha256, in manifest order. */
export function patchSetDigest(manifest: PatchSetManifest): string {
	const material = JSON.stringify([
		manifest.baseRevision,
		manifest.patches.map(patch => [patch.file, patch.sha256]),
	]);
	return createHash("sha256").update(material).digest("hex");
}

/**
 * Read `patches/desktop/manifest.json` under `root` and verify every patch file's bytes
 * match its recorded sha256; throws on mismatch/missing. Returns the manifest and its digest.
 */
export function readPatchSet(root: string): { readonly manifest: PatchSetManifest; readonly digest: string } {
	const manifestPath = join(root, PATCH_DIR, PATCH_MANIFEST);
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PatchSetManifest;
	for (const patch of manifest.patches) {
		const patchPath = join(root, PATCH_DIR, patch.file);
		const actual = fileSha256(patchPath);
		if (actual === undefined) {
			throw new Error(`Patch file is missing: ${patchPath} (listed in ${manifestPath})`);
		}
		if (actual !== patch.sha256) {
			throw new Error(`Patch ${patch.file} does not match its recorded sha256: ${patchPath} (expected ${patch.sha256}, got ${actual})`);
		}
	}
	return { manifest, digest: patchSetDigest(manifest) };
}

/** sha256 hex of a file, or undefined when it cannot be read. */
export function fileSha256(path: string): string | undefined {
	try {
		return createHash("sha256").update(readFileSync(path)).digest("hex");
	} catch {
		return undefined;
	}
}

/** Newest mtime (ms) of the patch files listed in the manifest, or undefined when none can be stat'ed. */
export function newestPatchMtime(root: string, manifest: PatchSetManifest): number | undefined {
	let newest: number | undefined;
	for (const patch of manifest.patches) {
		try {
			const { mtimeMs } = statSync(join(root, PATCH_DIR, patch.file));
			if (newest === undefined || mtimeMs > newest) newest = mtimeMs;
		} catch {
			// A patch that cannot be stat'ed contributes no time. `readPatchSet` rejects a
			// missing patch before a caller gets here, so this only keeps the helper total.
		}
	}
	return newest;
}

/** True when the bundle was (re)written at or after the newest patch. No patches or unknown patch time counts as fresh. */
export function isShellFresh(bundleMtimeMs: number | undefined, newestPatchMtimeMs: number | undefined): boolean {
	if (newestPatchMtimeMs === undefined) return true;
	if (bundleMtimeMs === undefined) return false;
	return bundleMtimeMs >= newestPatchMtimeMs;
}
