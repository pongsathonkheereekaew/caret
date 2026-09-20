import { describe, expect, it } from "bun:test";
import { shortcutRowsFromContributes } from "../src/shortcut-rows.ts";

const FIXTURE = {
	commands: [
		{ command: "cedia.openComposer", title: "Focus Composer" },
		{ command: "cedia.newTask" },
		{ command: "workbench.action.files.save", title: "Save" },
	],
	keybindings: [
		{ command: "cedia.openComposer", key: "ctrl+j", mac: "cmd+j" },
		{ command: "cedia.newTask", key: "ctrl+n" },
		{ command: "workbench.action.files.save", key: "ctrl+s", mac: "cmd+s" },
	],
};

describe("shortcutRowsFromContributes", () => {
	it("returns one cedia row per command that already has a keybinding", () => {
		expect(shortcutRowsFromContributes(FIXTURE)).toEqual([
			{ id: "cedia.openComposer", command: "cedia.openComposer", title: "Focus Composer", keybinding: "cmd+j" },
			{ id: "cedia.newTask", command: "cedia.newTask", title: "cedia.newTask", keybinding: "ctrl+n" },
		]);
	});

	it("returns no rows for empty or malformed contributes", () => {
		expect(shortcutRowsFromContributes(undefined)).toEqual([]);
		expect(shortcutRowsFromContributes(null)).toEqual([]);
		expect(shortcutRowsFromContributes([])).toEqual([]);
		expect(shortcutRowsFromContributes("cloud")).toEqual([]);
		expect(shortcutRowsFromContributes({})).toEqual([]);
		expect(shortcutRowsFromContributes({ commands: FIXTURE.commands })).toEqual([]);
		expect(shortcutRowsFromContributes({ keybindings: "nope" })).toEqual([]);
	});

	it("reads advertised cedia.* chords from the Mac package contributes", async () => {
		const pkg = await import("../package.json");
		const rows = shortcutRowsFromContributes(pkg.contributes);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((row) => row.command.startsWith("cedia.") && row.keybinding.length > 0)).toBe(true);
		expect(rows.some((row) => row.command === "cedia.showAgents" && row.keybinding === "cmd+alt+a")).toBe(true);
		expect(rows.some((row) => /cloud/i.test(row.command) || /cloud/i.test(row.title))).toBe(false);
	});

	it("does not invent Cloud rows or chords", () => {
		const rows = shortcutRowsFromContributes(FIXTURE);
		expect(rows.some((row) => /cloud/i.test(row.command) || /cloud/i.test(row.title))).toBe(false);
		expect(rows.every((row) => row.keybinding === "cmd+j" || row.keybinding === "ctrl+n")).toBe(true);
	});
});
