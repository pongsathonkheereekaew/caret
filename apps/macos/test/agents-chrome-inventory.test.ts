import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	chromeControlsFromTree,
	cleanLabel,
	deviationReasons,
	diffChrome,
	formatInventory,
	type ChromeControl,
} from "../../../scripts/lib/agents-chrome-inventory.ts";

const root = join(import.meta.dir, "..", "..", "..");
const REFERENCE = join(root, "docs", "maintenance", "evidence", "cursor-agents-ax-2026-09-14", "cursor-agents-ax-tree.txt");

describe("chrome inventory", () => {
	it("reads the reference capture into roles and labels", () => {
		// The exact shapes the Computer Use capture writes: an index, a role, a
		// leading state marker on some nodes, and shortcut/value tails.
		const controls = chromeControlsFromTree([
			"\t\t6 button Hide Sidebar",
			"\t\t7 button (disabled) Go Back",
			"\t\t51 text entry area (settable) Plan, Build, / for skills, @ for context",
			"\t\t82 combo box (settable) Open new tab menu",
			"\t\t65 button Plan New Idea \u21e7Tab",
			"\t\t55 pop up button High",
			"\t\t42 splitter Description: Resize sidebar, Value: 100",
			"\t\t41 toggle button Description: Settings, Value: 0",
			"\t\t35 container Getting Started",
			"\t\t36 text Getting Started",
			"",
		].join("\n"));
		expect(controls).toEqual([
			{ role: "button", label: "Hide Sidebar" },
			{ role: "button", label: "Go Back" },
			{ role: "text entry area", label: "Plan, Build, / for skills, @ for context" },
			{ role: "combo box", label: "Open new tab menu" },
			{ role: "button", label: "Plan New Idea" },
			{ role: "pop up button", label: "High" },
			{ role: "splitter", label: "Resize sidebar" },
			{ role: "toggle button", label: "Settings" },
		]);
	});

	it("keeps a container out of the inventory and collapses repeats", () => {
		const controls = chromeControlsFromTree(["button Hide Apps", "button Hide Apps", "container Panel editor-panel-group"].join("\n"));
		expect(controls).toEqual([{ role: "button", label: "Hide Apps" }]);
	});

	it("trims only the capture's own attribute text", () => {
		expect(cleanLabel(" (settable) main")).toBe("main");
		expect(cleanLabel("Build from a design Turn a frame into working UI in this repo")).toBe("Build from a design Turn a frame into working UI in this repo");
	});

	it("reports the reference's own controls as the parity direction", () => {
		const reference: readonly ChromeControl[] = [{ role: "button", label: "Hide Sidebar" }, { role: "button", label: "Multitask" }];
		const cedia: readonly ChromeControl[] = [{ role: "button", label: "Hide Sidebar" }, { role: "button", label: "Toggle Side Panel" }];
		const diff = diffChrome(reference, cedia);
		expect(diff.shared).toEqual([{ role: "button", label: "Hide Sidebar" }]);
		expect(diff.missing).toEqual([{ role: "button", label: "Multitask" }]);
		expect(diff.extra).toEqual([{ role: "button", label: "Toggle Side Panel" }]);
	});

	it("consumes a repeated label one for one instead of matching it twice", () => {
		const reference: readonly ChromeControl[] = [{ role: "button", label: "File" }, { role: "button", label: "File" }];
		const cedia: readonly ChromeControl[] = [{ role: "button", label: "File" }];
		expect(diffChrome(reference, cedia).missing).toEqual([{ role: "button", label: "File" }]);
	});

	it("keeps a recorded deviation out of the failure list, with its reason", () => {
		const reference: readonly ChromeControl[] = [{ role: "button", label: "Hide Apps" }];
		const diff = diffChrome(reference, []);
		expect(diff.missing).toEqual([]);
		expect(diff.deviations).toEqual(reference);
		expect(deviationReasons(diff.deviations)).toEqual(["Hide Apps - section 5: the Agents window keeps its current panel controls"]);
	});

	it("matches the two capture shapes: a merged row label and a longer Cedia label", () => {
		const reference: readonly ChromeControl[] = [
			{ role: "button", label: "Projects New Project" },
			{ role: "button", label: "Go Back" },
		];
		const cedia: readonly ChromeControl[] = [
			{ role: "button", label: "New Project" },
			{ role: "button", label: "Go Back One Session" },
		];
		const diff = diffChrome(reference, cedia);
		expect(diff.missing).toEqual([]);
		expect(diff.renamed).toEqual([
			{ reference: { role: "button", label: "Projects New Project" }, cedia: { role: "button", label: "New Project" } },
			{ reference: { role: "button", label: "Go Back" }, cedia: { role: "button", label: "Go Back One Session" } },
		]);
	});

	it("does not match a control just because its name appears inside another", () => {
		// The reference's starter card contains the word Find, and Cedia's
		// transcript find box is a different control.
		const reference: readonly ChromeControl[] = [{ role: "button", label: "Debug an issue Find root causes and fix tricky bugs" }];
		const cedia: readonly ChromeControl[] = [{ role: "button", label: "Find" }];
		const diff = diffChrome(reference, cedia);
		expect(diff.renamed).toEqual([]);
		expect(diff.missing).toEqual(reference);
	});

	it("reads the shipped reference capture and finds the controls the plan names", () => {
		const controls = chromeControlsFromTree(readFileSync(REFERENCE, "utf8"));
		const labels = controls.map(control => control.label);
		for (const label of ["Hide Sidebar", "Hide Apps", "Enter Full Screen", "Plan New Idea", "Multitask", "High"]) {
			expect(`${label}: ${labels.includes(label)}`).toBe(`${label}: true`);
		}
		// The two layout controls the plan says the reference does not have.
		expect(labels).not.toContain("Show Panel");
		expect(labels).not.toContain("Toggle Side Panel");
		expect(formatInventory(controls).split("\n").length).toBe(controls.length);
	});
});
