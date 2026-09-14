/** Structural checks for the personal packaged Caret.app. Not a UI/Undo receipt. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileSha256 } from "./lib/omp-runtime-integrity.ts";
import { PERSONAL_PASSWORD_STORE } from "./lib/personal-argv.ts";

const root = resolve(import.meta.dir, "..");
const app = join(root, `VSCode-darwin-${process.arch}`, "Caret.app");
const binary = join(app, "Contents/MacOS/Caret");
const argv = JSON.parse(readFileSync(join(app, "Contents/Resources/app/argv.json"), "utf8")) as { [key: string]: unknown };
const bundledOmp = join(app, "Contents/Resources/app/extensions/caret/runtime/omp/omp");
const bundledHost = join(app, "Contents/Resources/app/extensions/caret/runtime/host/cli.js");
const check = (condition: unknown, message: string) => {
	if (!condition) throw new Error(message);
};
check(existsSync(binary), `Missing Caret binary at ${binary}`);
check(readFileSync(binary).subarray(0, 4).toString("ascii") !== "", "Caret binary is empty");
execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "pipe" });
check(argv["password-store"] === PERSONAL_PASSWORD_STORE, "Packaged argv.json must skip Keychain via password-store=basic");
check(argv["use-inmemory-secretstorage"] === true, "Packaged argv.json must keep secret storage in memory so a re-signed bundle never raises a Keychain prompt");
check(argv["enable-crash-reporter"] === false, "Packaged argv.json must disable crash reporter");
check(existsSync(bundledOmp), "Packaged app is missing bundled standalone OMP");
check(existsSync(bundledHost), "Packaged app is missing bundled host");
const receipt = {
	capturedAt: new Date().toISOString(),
	app,
	binary,
	passwordStore: argv["password-store"],
	inmemorySecretStorage: argv["use-inmemory-secretstorage"],
	ompSha256: fileSha256(bundledOmp),
	hostSha256: fileSha256(bundledHost),
	checks: [
		"caret-binary-present",
		"adhoc-codesign-verify",
		"argv-password-store-basic",
		"argv-inmemory-secretstorage",
		"bundled-standalone-omp",
		"bundled-host",
	],
	uiVerified: false,
	ios: "deferred",
};
const evidence = join(root, "docs/maintenance/evidence/packaged-caret-2026-09-13");
mkdirSync(evidence, { recursive: true });
writeFileSync(join(evidence, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
