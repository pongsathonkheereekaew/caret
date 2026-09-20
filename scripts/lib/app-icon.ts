/** Cedia's macOS app-bundle helpers: the brand icon and the dev-shell cleanup.
 *
 * Replacing `Contents/Resources/<icon>.icns` on its own does not change what
 * Finder or the Dock draw. Both cache the icon per bundle path and key that
 * cache on the bundle's modification time plus its LaunchServices record, so a
 * rebuilt app keeps showing the previous artwork until the bundle is touched
 * and re-registered. That is why swapping `resources/darwin/code.icns` and
 * re-running a package step used to leave the VS Code icon on screen.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, utimes } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

const LSREGISTER =
	"/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

/** Remove the incomplete dev Electron shell so a build leaves one Cedia, not two.
 *
 * `gulp electron` extracts the dev app to `.build/electron/<nameShort>.app`. It has no app
 * payload and none of the Cedia surfaces, yet `desktop/scripts/code.sh` launches it by the
 * same name and the packaging task builds the real bundle from the same config - so a build
 * left two apps called "Cedia" for LaunchServices, Spotlight and Finder, and the OS could
 * open the broken one. A desktop build is meant to produce one Cedia, so this unregisters the
 * shell and deletes it; `code.sh` recreates it on demand for the dev window.
 *
 * Two checks guard the deletion, because the shell and the packaged app can share an
 * identifier: the bundle must live under the `desktop/.build` tree, and it must carry no app
 * payload (only a real Cedia has `Contents/Resources/app/out/vs/sessions/sessions.desktop.main.js`).
 * A mis-resolved path cannot reach the package. Returns true when a shell was removed.
 */
export async function removeDevBundle(appBundle: string): Promise<boolean> {
	const plist = join(appBundle, "Contents", "Info.plist");
	if (!existsSync(plist)) return false;
	if (!appBundle.split(sep).includes(".build")) return false; // Only ever the dev tree.
	if (existsSync(join(appBundle, "Contents", "Resources", "app", "out", "vs", "sessions", "sessions.desktop.main.js"))) return false; // A real app payload survives.
	if (existsSync(LSREGISTER)) {
		try {
			execFileSync(LSREGISTER, ["-u", appBundle], { stdio: "ignore" });
		} catch {
			// Unregistering is a cache edit; the deletion below is what matters.
		}
	}
	await rm(appBundle, { recursive: true, force: true });
	return true;
}

/** Copy `icns` over the bundle's declared icon and refresh the icon caches.
 *
 * Returns the written path, or `undefined` when the path is not a macOS bundle
 * so callers stay silent about builds that never produced one.
 */
export async function applyDarwinAppIcon(appBundle: string, icns: string): Promise<string | undefined> {
	const plist = join(appBundle, "Contents", "Info.plist");
	if (!existsSync(plist)) return undefined;
	const iconName = execFileSync("plutil", ["-extract", "CFBundleIconFile", "raw", "-o", "-", plist], { encoding: "utf8" }).trim();
	if (!iconName) throw new Error(`No CFBundleIconFile in ${plist}`);
	const target = join(appBundle, "Contents", "Resources", iconName);
	await mkdir(dirname(target), { recursive: true });
	await copyFile(icns, target);
	const now = new Date();
	await utimes(target, now, now);
	await utimes(appBundle, now, now);
	if (existsSync(LSREGISTER)) {
		try {
			execFileSync(LSREGISTER, ["-f", appBundle], { stdio: "ignore" });
		} catch {
			// Registration is only a cache hint; the copied icon stands alone.
		}
	}
	return target;
}
