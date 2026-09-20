import { describe, expect, it } from "bun:test";
import { createCediaContextMenuPresenter } from "../src/cedia-context-menu.ts";

describe("Cedia context menu bridge", () => {
	 it("forwards thread menu items and pointer position to the Synara presenter", async () => {
		const calls: unknown[] = [];
		const present = createCediaContextMenuPresenter(async (items, position) => {
			calls.push({ items, position });
			return "rename";
		});
		const items = [{ id: "rename", label: "Rename", icon: "pencil" }] as const;
		expect(await present(items, { x: 24, y: 48 })).toBe("rename");
		expect(calls).toEqual([{ items, position: { x: 24, y: 48 } }]);
	 });
});
