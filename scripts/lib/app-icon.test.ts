import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDarwinAppIcon, removeDevBundle } from "./app-icon.ts";

/** Every temporary artefact this file creates, so the suite leaves nothing behind. */
const scratch: string[] = [];

afterAll(() => {
	for (const path of scratch) rmSync(path, { recursive: true, force: true });
});

function fakeBundle(plist: string): string {
	const app = mkdtempSync(join(tmpdir(), "cedia-app-icon-"));
	scratch.push(app);
	mkdirSync(join(app, "Contents"), { recursive: true });
	writeFileSync(join(app, "Contents", "Info.plist"), plist);
	return app;
}

function plistWith(iconFile?: string): string {
	const iconEntry = iconFile ? `<key>CFBundleIconFile</key><string>${iconFile}</string>` : "";
	return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${iconEntry}</dict></plist>`;
}

/** A bundle under a `.build` tree, which is the only place removeDevBundle will delete. */
function fakeBuildBundle(plist: string): string {
	const root = mkdtempSync(join(tmpdir(), "cedia-build-"));
	scratch.push(root);
	const app = join(root, ".build", "electron", "Cedia.app");
	mkdirSync(join(app, "Contents"), { recursive: true });
	writeFileSync(join(app, "Contents", "Info.plist"), plist);
	return app;
}

/** A brand icon in the temp directory, tracked so the suite removes it. */
function brandIcon(): string {
	const icns = mkdtempSync(join(tmpdir(), "cedia-brand-"));
	scratch.push(icns);
	return join(icns, "icon.icns");
}

describe("macOS app icon propagation", () => {
	it("writes the brand icon under the name the bundle declares", async () => {
		const app = fakeBundle(plistWith("Cedia.icns"));
		const icns = brandIcon();
		await writeFile(icns, "brand-icon-bytes");

		const written = await applyDarwinAppIcon(app, icns);

		expect(written).toBe(join(app, "Contents", "Resources", "Cedia.icns"));
		expect(await readFile(written!, "utf8")).toBe("brand-icon-bytes");
	});

	it("moves the bundle timestamp so Finder and the Dock drop the cached icon", async () => {
		const app = fakeBundle(plistWith("Cedia.icns"));
		const icns = brandIcon();
		await mkdir(join(app, "Contents", "Resources"), { recursive: true });
		await writeFile(join(app, "Contents", "Resources", "Cedia.icns"), "old-icon-bytes");
		await writeFile(icns, "brand-icon-bytes");
		const before = (await stat(app)).mtimeMs;

		await applyDarwinAppIcon(app, icns);

		expect((await stat(app)).mtimeMs).toBeGreaterThanOrEqual(before);
	});

	it("stays silent for paths that are not macOS bundles", async () => {
		expect(await applyDarwinAppIcon(join(tmpdir(), "there-is-no-app-here"), join(tmpdir(), "x.icns"))).toBeUndefined();
		expect(existsSync(join(tmpdir(), "there-is-no-app-here"))).toBe(false);
	});

	it("fails loud when a bundle declares no icon", async () => {
		await expect(applyDarwinAppIcon(fakeBundle(plistWith()), join(tmpdir(), "x.icns"))).rejects.toThrow("CFBundleIconFile");
	});
});

describe("dev shell removal", () => {
	it("removes a payload-less shell under the build tree", async () => {
		const shell = fakeBuildBundle(plistWith("Cedia.icns"));

		expect(await removeDevBundle(shell)).toBe(true);
		expect(existsSync(shell)).toBe(false);
	});

	it("refuses a bundle outside the build tree, so the packaged app survives a mis-resolved path", async () => {
		const packaged = fakeBundle(plistWith("Cedia.icns"));

		expect(await removeDevBundle(packaged)).toBe(false);
		expect(existsSync(packaged)).toBe(true);
	});

	it("refuses a bundle that carries the real sessions payload", async () => {
		const real = fakeBuildBundle(plistWith("Cedia.icns"));
		const payload = join(real, "Contents", "Resources", "app", "out", "vs", "sessions", "sessions.desktop.main.js");
		mkdirSync(join(payload, ".."), { recursive: true });
		writeFileSync(payload, "// real workbench");

		expect(await removeDevBundle(real)).toBe(false);
		expect(existsSync(real)).toBe(true);
	});
});
