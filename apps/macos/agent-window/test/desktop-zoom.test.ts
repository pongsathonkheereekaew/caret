import { expect, it } from "bun:test";
import { CEDIA_ZOOM_EVENT, createDesktopZoomController } from "../src/desktopZoom";

it("hydrates the restored native zoom factor and publishes later changes", async () => {
	let eventListener: ((event: unknown, ...args: unknown[]) => void) | undefined;
	const bridge = {
		invoke: async () => 1.25,
		on: (_channel: string, listener: (event: unknown, ...args: unknown[]) => void) => { eventListener = listener; },
		removeListener: () => undefined,
	};
	const controller = createDesktopZoomController(bridge);
	const changes: number[] = [];
	controller.onZoomFactorChange(value => changes.push(value));
	await Promise.resolve();
	await Promise.resolve();
	expect(controller.getZoomFactor()).toBe(1.25);

	eventListener?.({}, 0.833333);
	expect(controller.getZoomFactor()).toBe(0.833333);
	expect(changes).toEqual([1.25, 0.833333]);
	controller.dispose();
});

it("ignores invalid native values instead of collapsing the layout", async () => {
	let eventListener: ((event: unknown, ...args: unknown[]) => void) | undefined;
	const bridge = {
		invoke: async () => 0,
		on: (_channel: string, listener: (event: unknown, ...args: unknown[]) => void) => { eventListener = listener; },
	};
	const controller = createDesktopZoomController(bridge);
	await Promise.resolve();
	await Promise.resolve();
	expect(controller.getZoomFactor()).toBe(1);
	eventListener?.({}, Number.NaN);
	expect(controller.getZoomFactor()).toBe(1);
	expect(CEDIA_ZOOM_EVENT).toBe("vscode:cediaZoomFactor");
});
