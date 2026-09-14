import { describe, expect, it } from "bun:test";
import { PendingFocus, ViewRegistry } from "../src/view-registry.ts";

class FakeView {
	static nextId = 1;
	readonly id = FakeView.nextId++;
}

describe("view registry fan-out", () => {
	it("keeps every resolved surface so both the sidebar and dock get snapshots", () => {
		const registry = new ViewRegistry<FakeView>();
		const sidebar = new FakeView();
		const dock = new FakeView();
		registry.add(sidebar);
		registry.add(dock);
		expect(registry.size).toBe(2);
		expect(registry.targets()).toEqual([sidebar, dock]);
	});

	it("drops a surface when it is disposed, not when another one appears", () => {
		const registry = new ViewRegistry<FakeView>();
		const sidebar = new FakeView();
		const dock = new FakeView();
		registry.add(sidebar);
		registry.add(dock);
		// Code-OSS reports the dispose; the extension removes it.
		registry.remove(sidebar);
		expect(registry.size).toBe(1);
		expect(registry.targets()).toEqual([dock]);
	});

	it("does not double-count the same surface", () => {
		const registry = new ViewRegistry<FakeView>();
		const view = new FakeView();
		registry.add(view);
		registry.add(view);
		expect(registry.size).toBe(1);
	});
});

describe("pending composer focus", () => {
	it("holds a focus request made before any view existed", () => {
		const focus = new PendingFocus();
		focus.request();
		expect(focus.isPending).toBe(true);
		// The first surface to resolve claims it...
		expect(focus.claim()).toBe(true);
		// ...and a later surface must not steal focus again.
		expect(focus.claim()).toBe(false);
		expect(focus.isPending).toBe(false);
	});

	it("does nothing when no focus was requested", () => {
		expect(new PendingFocus().claim()).toBe(false);
	});
});
