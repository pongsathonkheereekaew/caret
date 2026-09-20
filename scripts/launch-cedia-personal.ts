import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { personalCediaLaunchArgs } from "./lib/personal-argv.ts";

const root = join(import.meta.dir, "..");
const app = join(root, `VSCode-darwin-${process.arch}`, "Cedia.app", "Contents", "MacOS", "Cedia");

/** Chromium stores its own "Safe Storage" key in the login keychain, and macOS
 * binds that item's access control to the code signature that created it. The
 * personal build is ad-hoc re-signed on every `--package`, so the next launch
 * is a different identity: macOS denies the read and raises a modal password
 * dialog. While that dialog is up the main process is blocked and every file
 * and configuration write in the window hangs, which is the state that made
 * the workbench look broken.
 *
 * Only the personal launcher does this, and only for Cedia's own item: the
 * fix is to drop the item that belongs to a previous signature so the freshly
 * signed bundle creates its own instead of waiting on a prompt. */
function clearStaleChromiumSafeStorage(): void {
	clearStaleService("Cedia Safe Storage");
	clearStaleService("Caret Safe Storage"); // legacy name, one-time migration
}
function clearStaleService(service: string): void {
	try {
		execFileSync("security", ["find-generic-password", "-s", service], { stdio: "ignore" });
	} catch {
		return; // No item yet: nothing can prompt, and the app will create one.
	}
	try {
		execFileSync("security", ["delete-generic-password", "-s", service], { stdio: "ignore" });
		process.stdout.write(`Cleared the stale "${service}" keychain item left by a previous signature.\n`);
	} catch (error) {
		// Not fatal: an unchanged signature still passes the access check.
		process.stderr.write(`Could not clear "${service}": ${error instanceof Error ? error.message : String(error)}\n`);
	}
}

if (!existsSync(app)) {
	process.stderr.write(`Cedia.app is not packaged at ${app}. Build with --package first.\n`);
	process.exitCode = 1;
} else {
	clearStaleChromiumSafeStorage();
	const child = spawn(app, [...personalCediaLaunchArgs()], { detached: true, stdio: "ignore" });
	child.unref();
	process.stdout.write(`Started personal Cedia with ${personalCediaLaunchArgs().join(" ")}\n`);
}
