import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/*
 * The desktop mirror has to be reproducible from the pinned base.
 *
 * `scripts/prepare-desktop.ts` builds the Code-OSS checkout by applying
 * `patches/desktop/*` in manifest order to the base revision, and it stops at the
 * first patch that does not apply. Nothing else in the repository checks that
 * property, so a patch regenerated from the already-patched working tree (which
 * happens whenever `git diff <paths>` is taken from the live checkout) quietly
 * inherits hunks that an earlier patch already applies, and the build only fails
 * much later, on a different machine, at `bun run prepare:desktop`.
 *
 * Two properties are asserted here:
 *   1. every patch applies, in manifest order, to a tree built from the base revision;
 *   2. the tree that produces is byte-identical to the checkout those patches describe,
 *      so a mirrored patch cannot drift from the code the app actually runs.
 */

const root = join(import.meta.dir, "..", "..", "..");
const desktop = join(root, "desktop");
const manifest = JSON.parse(readFileSync(join(root, "patches", "desktop", "manifest.json"), "utf8")) as {
	readonly baseRevision: string;
	readonly patches: readonly { readonly file: string }[];
};

/** Every path a patch touches, with whether the patch creates it. */
function filesOf(patchText: string): { path: string; created: boolean }[] {
	const files: { path: string; created: boolean }[] = [];
	for (const section of patchText.split(/^diff --git /m).slice(1)) {
		const header = section.match(/^a\/(\S+) b\//);
		if (!header) continue;
		files.push({ path: header[1]!, created: /^new file mode \d+/m.test(section) });
	}
	return files;
}

/** The base content of a path, or undefined when the base revision has no such file. */
function baseContent(path: string): string | undefined {
	try {
		// A path the base revision does not have is a file the patch creates; the
		// "not in <rev>" report is expected, so it must not reach the test output.
		return execFileSync("git", ["show", `${manifest.baseRevision}:${path}`], { cwd: desktop, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	} catch {
		return undefined;
	}
}

describe("desktop patch set", () => {
	it("applies every patch, in manifest order, to the pinned base", () => {
		const work = mkdtempSync(join(tmpdir(), "cedia-patch-set-"));
		try {
			for (const patch of manifest.patches) {
				for (const file of filesOf(readFileSync(join(root, "patches", "desktop", patch.file), "utf8"))) {
					const base = file.created ? undefined : baseContent(file.path);
					if (base === undefined) continue;
					mkdirSync(dirname(join(work, file.path)), { recursive: true });
					writeFileSync(join(work, file.path), base);
				}
			}

			const failures: string[] = [];
			for (const patch of manifest.patches) {
				try {
					execFileSync("git", ["apply", join(root, "patches", "desktop", patch.file)], { cwd: work, stdio: "pipe" });
				} catch (error) {
					const message = error instanceof Error && "stderr" in error ? String((error as { stderr: unknown }).stderr).trim() : String(error);
					failures.push(`${patch.file}: ${message.split("\n").slice(0, 2).join(" ")}`);
				}
			}
			expect(failures.join("\n") || "all applied").toBe("all applied");

			// The mirror describes the checkout exactly: same content for every path
			// the patches touch, so nothing here is a patch that drifted.
			const drifted = manifest.patches.flatMap(patch =>
				filesOf(readFileSync(join(root, "patches", "desktop", patch.file), "utf8"))
					.filter(file => {
						const patched = readFileSync(join(work, file.path), "utf8");
						const checkout = readFileSync(join(desktop, file.path), "utf8");
						return patched !== checkout;
					})
					.map(file => `${patch.file} -> ${file.path}`));
			expect(drifted.join("\n") || "no drift").toBe("no drift");
		} finally {
			rmSync(work, { recursive: true, force: true });
		}
	});
});
