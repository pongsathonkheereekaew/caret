/** Personal-use Code-OSS argv: never touch the macOS Keychain.
 *
 * `password-store=basic` alone still routes VS Code's secret storage through
 * Electron `safeStorage`, which reads/writes the "Caret Safe Storage" keychain
 * item. Ad-hoc re-signing changes the app identity, so each rebuilt bundle is
 * denied access and macOS raises a modal password dialog; while that dialog is
 * up the main process stalls, which used to hang every file and configuration
 * write in the window. In-memory secret storage removes the Keychain entirely.
 */

export const PERSONAL_PASSWORD_STORE = "basic" as const;
export const PERSONAL_INMEMORY_SECRET_STORAGE = true as const;

export function personalCaretArgv(): Record<string, string | boolean> {
	return {
		"password-store": PERSONAL_PASSWORD_STORE,
		"use-inmemory-secretstorage": PERSONAL_INMEMORY_SECRET_STORAGE,
		"enable-crash-reporter": false,
	};
}

export function personalCaretLaunchArgs(): readonly string[] {
	return [`--password-store=${PERSONAL_PASSWORD_STORE}`, "--use-inmemory-secretstorage"];
}
