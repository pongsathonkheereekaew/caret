/** Read-only verifier for a packaged Cedia.app's desktop shell freshness.
 *
 * Why this exists: `product.json` used to prove only which upstream revision was pinned,
 * so a package whose bundled shell predated the current `patches/desktop` set looked
 * exactly like a current one. That is how a stale desktop shell survived a rebuild: the
 * identity was `main` and the shell behind it was not. This script recomputes the
 * patch-set digest, the two shell bundle hashes and the Cedia extension hash from the
 * repository and compares them with the `cedia` stamp `scripts/build-cedia.ts` writes at
 * `--package` time. It also reports, as a separate line, whether each shell bundle's
 * mtime is at or after the newest patch: a stale shell means rebuild - not a re-sign.
 *
 * It never writes and never talks to a provider.
 *
 * usage: bun scripts/check-packaged-shell.ts [path/to/Cedia.app]
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileSha256, isShellFresh, newestPatchMtime, readPatchSet, type PatchSetManifest } from "./lib/patch-set-digest.ts";
import { agentWindowDigest } from "./lib/agent-window-assets.ts";

const root = resolve(import.meta.dir, "..");
const app = process.argv[2] ?? join(root, `VSCode-darwin-${process.arch}`, "Cedia.app");
const appResources = join(app, "Contents/Resources/app");
const productPath = join(appResources, "product.json");

interface PackagedCediaStamp {
	patchSetSha256?: string;
	baseRevision?: string;
	patchCount?: number;
	packagedAt?: string;
	shell?: { sessions?: string; workbench?: string; main?: string };
	agentWindow?: string;
	extension?: string;
}

const sessionsBundle = join(appResources, "out/vs/sessions/sessions.desktop.main.js");
const workbenchBundle = join(appResources, "out/vs/workbench/workbench.desktop.main.js");
const shellArtifacts = [
	{ name: "sessions shell", path: sessionsBundle },
	{ name: "workbench shell", path: workbenchBundle },
	{ name: "native main", path: join(appResources, "out/main.js") },
];
const artifacts = [
	...shellArtifacts,
	{ name: "cedia extension", path: join(appResources, "extensions/cedia/out/extension.js") },
];

let failed = false;
function fail(message: string): void {
	failed = true;
	console.log(`FAIL ${message}`);
}
function ok(message: string): void {
	console.log(`OK   ${message}`);
}

/** Name of the newest patch file, so a stale-shell line can say which patch a rebuild is missing. */
function newestPatchFile(manifest: PatchSetManifest): string | undefined {
	let newest: { file: string; mtimeMs: number } | undefined;
	for (const patch of manifest.patches) {
		try {
			const { mtimeMs } = statSync(join(root, "patches", "desktop", patch.file));
			if (!newest || mtimeMs > newest.mtimeMs) newest = { file: patch.file, mtimeMs };
		} catch {
			// readPatchSet already rejects an unreadable patch; here it contributes no name.
		}
	}
	return newest?.file;
}

function bundleMtime(path: string): number | undefined {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return undefined;
	}
}

console.log(`App      ${app}`);
console.log(`Product  ${productPath}`);

let product: { cedia?: PackagedCediaStamp };
try {
	product = JSON.parse(readFileSync(productPath, "utf8"));
} catch (error) {
	fail(`cannot read ${productPath}: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}

const stamp = product.cedia;
if (!stamp) {
	fail(`${productPath} carries no cedia stamp: this package predates it and must be repackaged (bun run package:mac). Nothing else can say which patch set built its shell.`);
	process.exit(1);
}
console.log(`Packaged ${stamp.packagedAt ?? "(no packagedAt)"}, upstream ${stamp.baseRevision ?? "(no baseRevision)"}, ${stamp.patchCount ?? "(no patchCount)"} patches`);

let patchSet: { readonly manifest: PatchSetManifest; readonly digest: string } | undefined;
try {
	patchSet = readPatchSet(root);
} catch (error) {
	fail(`cannot read the repository patch set: ${error instanceof Error ? error.message : String(error)}`);
}
if (patchSet) {
	if (stamp.patchSetSha256 === patchSet.digest) ok(`patch set sha256 matches the repository (${patchSet.digest})`);
	else fail(`patch set sha256 ${stamp.patchSetSha256 ?? "(missing)"} does not match the repository digest ${patchSet.digest}: this package was built from a different patch set`);
	if (stamp.baseRevision === patchSet.manifest.baseRevision) ok(`base revision matches the repository (${stamp.baseRevision})`);
	else fail(`base revision ${stamp.baseRevision ?? "(missing)"} does not match the repository base ${patchSet.manifest.baseRevision}`);
	if (stamp.patchCount === patchSet.manifest.patches.length) ok(`patch count matches the repository (${stamp.patchCount})`);
	else fail(`patch count ${stamp.patchCount ?? "(missing)"} does not match the repository's ${patchSet.manifest.patches.length}`);
}

const recordedHashes = [stamp.shell?.sessions, stamp.shell?.workbench, stamp.shell?.main, stamp.extension];
for (const [index, artifact] of artifacts.entries()) {
	const recorded: string | undefined = recordedHashes[index];
	if (recorded === undefined) {
		fail(`${artifact.name} has no recorded sha256 in the cedia stamp: ${artifact.path}`);
		continue;
	}
	const actual = fileSha256(artifact.path);
	if (actual === recorded) ok(`${artifact.name} sha256 matches the stamp (${actual})`);
	else fail(`${artifact.name} sha256 ${actual ?? "(unreadable)"} does not match the stamp's ${recorded}: ${artifact.path}`);
}

const agentDigest = agentWindowDigest(join(appResources, "out/vs/cedia/agent"));
const localAgentDigest = agentWindowDigest(join(root, "dist/agent-window"));
if (agentDigest && agentDigest === stamp.agentWindow && agentDigest === localAgentDigest) ok(`Agent Window assets match the stamp and local build (${agentDigest})`);
else fail("Agent Window assets are missing or differ from the stamp/local build; rebuild and package the Agent Window");

if (patchSet) {
	const newestMtime = newestPatchMtime(root, patchSet.manifest);
	const newestFile = newestPatchFile(patchSet.manifest);
	for (const artifact of shellArtifacts) {
		const mtime = bundleMtime(artifact.path);
		if (isShellFresh(mtime, newestMtime)) {
			ok(`${artifact.name} is at least as new as the newest patch (patches/desktop/${newestFile ?? "none"})`);
		} else {
			fail(`${artifact.name} is missing or predates the current patch set; the newest patch is patches/desktop/${newestFile ?? "(unknown)"} and ${artifact.path} must be rebuilt (prepare-desktop + the pinned gulp task) and repackaged - re-signing will not fix it`);
		}
	}
}

console.log(failed ? "FAIL packaged Cedia.app does not verifiably match the current patch set" : "OK   packaged Cedia.app matches the current patch set");
process.exitCode = failed ? 1 : 0;
