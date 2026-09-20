import { describe, expect, it } from "bun:test";
import { PERSONAL_INMEMORY_SECRET_STORAGE, personalCediaArgv, personalCediaLaunchArgs } from "./personal-argv.ts";

describe("personal Cedia argv", () => {
	it("uses the basic password store so a local build does not wait on Keychain", () => {
		expect(personalCediaArgv()).toMatchObject({
			"password-store": "basic",
			"use-inmemory-secretstorage": true,
			"enable-crash-reporter": false,
		});
		expect(personalCediaLaunchArgs()).toEqual(["--password-store=basic", "--use-inmemory-secretstorage"]);
	});

	it("keeps secret storage in memory so a re-signed bundle cannot stall on a Keychain prompt", () => {
		// Ad-hoc re-signing changes the code identity, so macOS denies access to
		// the "Cedia Safe Storage" item and raises a modal dialog. While it is up
		// the main process is blocked and every fs/config write hangs.
		expect(personalCediaArgv()["use-inmemory-secretstorage"]).toBe(PERSONAL_INMEMORY_SECRET_STORAGE);
		expect(personalCediaLaunchArgs()).toContain("--use-inmemory-secretstorage");
	});
});
