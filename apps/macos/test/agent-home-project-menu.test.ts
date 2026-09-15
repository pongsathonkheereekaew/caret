import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The Agent Home project menu is a contract between two checkouts: the menu is
 * built in the desktop workbench (`agentHomeNav.ts`), and every entry it offers
 * is a command only this extension registers. Nothing links the two at compile
 * time, and the nav's failure path reports an unregistered command as a warning
 * rather than throwing, so a renamed or dropped command would leave a menu that
 * looks right and does nothing.
 *
 * The entries and their order are the reference project-row menu measured from
 * the reference capture, so the assertions below also pin the order: the menu is
 * read top-down, and reordering it would silently disagree with the reference.
 */

const here = dirname(fileURLToPath(import.meta.url));
const navSource = readFileSync(
	join(here, "..", "..", "..", "desktop", "src", "vs", "sessions", "contrib", "home", "browser", "agentHomeNav.ts"),
	"utf8",
);
const extensionSource = readFileSync(join(here, "..", "src", "extension.ts"), "utf8");

/** The reference project menu, in the order the reference draws it. */
const REFERENCE_MENU = [
	{ key: "pin", command: "caret.project.setPinned", label: "Pin Project" },
	{ key: "edit", command: "caret.project.rename", label: "Edit Project..." },
	{ key: "reveal", command: "caret.project.reveal", label: "Reveal in Finder" },
	{ key: "worktree", command: "caret.project.createWorktree", label: "Create Permanent Worktree" },
	{ key: "archiveChats", command: "caret.project.archiveChats", label: "Archive Chats" },
	{ key: "remove", command: "caret.project.remove", label: "Remove Project" },
] as const;

/** The nav's command table: `key: 'command.id'`, in declaration order. */
const navCommands = new Map(
	[...navSource.matchAll(/\b(\w+): '(caret\.project\.[\w]+)'/g)].map(match => [match[1]!, match[2]!] as const),
);

/** The actions the menu builds: the command key and its label, in build order. */
const menuActions = [...navSource.matchAll(/action\(CARET_PROJECT_COMMANDS\.(\w+),\s*localize\('[^']*',\s*"([^"]+)"\)\)/g)]
	.map(match => ({ key: match[1]!, label: match[2]! }));

/** Every command id this extension registers. */
const registeredCommands = new Set(
	[...extensionSource.matchAll(/registerCommand\("([^"]+)"/g)].map(match => match[1]!),
);

describe("Agent Home project menu", () => {
	it("builds the reference entries in the reference order", () => {
		expect(menuActions.map(entry => entry.label)).toEqual(REFERENCE_MENU.map(entry => entry.label));
		expect([...navCommands.keys()]).toEqual(REFERENCE_MENU.map(entry => entry.key));
		for (const entry of REFERENCE_MENU) {
			expect(navCommands.get(entry.key)).toBe(entry.command);
		}
	});

	it("runs only commands the extension registers", () => {
		expect(menuActions.length).toBe(REFERENCE_MENU.length);
		for (const entry of REFERENCE_MENU) {
			expect(`${entry.command}: ${registeredCommands.has(entry.command)}`).toBe(`${entry.command}: true`);
		}
	});

	it("binds right-click on the project groups the session list stacks", () => {
		// The reference's Projects section is a header with its `+` action; the projects
		// are the workspace groups the session list draws below it, so the delegated
		// listener is the one that carries the menu.
		const contextMenus = [...navSource.matchAll(/EventType\.CONTEXT_MENU/g)].length;
		expect(contextMenus).toBe(1);
		expect(navSource).toContain("attachSessionsListMenu");
		expect(navSource).toContain("section-icon.codicon-folder");
		// Without this the menu opens on top of the browser's own context menu.
		expect([...navSource.matchAll(/event\.preventDefault\(\)/g)].length).toBe(contextMenus);
	});

	it("reports an action that cannot run instead of failing silently", () => {
		expect(navSource).toContain("notificationService.warn");
		expect(navSource).toContain("caret.project.actionFailed");
	});
});
