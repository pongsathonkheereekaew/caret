import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDarwinAppIcon } from "./app-icon.ts";

function fakeBundle(plist: string): string {
	const app = mkdtempSync(join(tmpdir(), "caret-app-icon-"));
	mkdirSync(join(app, "Contents"), { recursive: true });
	writeFileSync(join(app, "Contents", "Info.plist"), plist);
	return app;
}

function plistWith(iconFile?: string): string {
	const iconEntry = iconFile ? `<key>CFBundleIconFile</key><string>${iconFile}</string>` : "";
	return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${iconEntry}</dict></plist>`;
}

describe("macOS app icon propagation", () => {
	it("writes the brand icon under the name the bundle declares", async () => {
		const app = fakeBundle(plistWith("Caret.icns"));
		const icns = join(tmpdir(), `caret-brand-${process.pid}.icns`);
		await writeFile(icns, "brand-icon-bytes");

		const written = await applyDarwinAppIcon(app, icns);

		expect(written).toBe(join(app, "Contents", "Resources", "Caret.icns"));
		expect(await readFile(written!, "utf8")).toBe("brand-icon-bytes");
	});

	it("moves the bundle timestamp so Finder and the Dock drop the cached icon", async () => {
		const app = fakeBundle(plistWith("Caret.icns"));
		const icns = join(tmpdir(), `caret-brand-${process.pid}.icns`);
		await mkdir(join(app, "Contents", "Resources"), { recursive: true });
		await writeFile(join(app, "Contents", "Resources", "Caret.icns"), "old-icon-bytes");
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
