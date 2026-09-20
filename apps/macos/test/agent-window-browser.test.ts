import { describe, expect, it } from "bun:test";

import { createAgentBrowserService, isCediaAgentBrowserWebContents } from "../src/agent-window-browser.ts";
import { createNativeBrowserApi } from "../agent-window/src/native-browser.ts";
import { ThreadId } from "../agent-window/vendor/synara/packages/contracts/src/index";

type Listener = (...args: any[]) => void;

class FakeWebContents {

	readonly id: number;
	private readonly listeners = new Map<string, Set<Listener>>();
	private url = "about:blank";
	private title = "New tab";
	private destroyed = false;
	readonly loaded: string[] = [];
	readonly openedDevTools: unknown[] = [];
	permissionCheck: (() => boolean) | undefined;
	permissionRequest: ((_contents: unknown, _permission: string, callback: (allowed: boolean) => void) => void) | undefined;
	readonly session = {
		setPermissionCheckHandler: (handler: () => boolean) => { this.permissionCheck = handler; },
		setPermissionRequestHandler: (handler: (_contents: unknown, _permission: string, callback: (allowed: boolean) => void) => void) => { this.permissionRequest = handler; },
	};

	constructor(id: number) {
		this.id = id;
	}

	on(event: string, listener: Listener): void {
		const listeners = this.listeners.get(event) ?? new Set<Listener>();
		listeners.add(listener);
		this.listeners.set(event, listeners);
	}

	removeListener(event: string, listener: Listener): void {
		this.listeners.get(event)?.delete(listener);
	}

	emit(event: string, ...args: any[]): void {
		for (const listener of this.listeners.get(event) ?? []) listener(...args);
	}

	setWindowOpenHandler(): void {}

	setURL(url: string): void {
		this.url = url;
	}

	getURL(): string {
		return this.url;
	}

	setTitle(title: string): void {
		this.title = title;
	}

	getTitle(): string {
		return this.title;
	}

	loadURL(url: string): Promise<void> {
		this.loaded.push(url);
		this.url = url;
		this.emit("did-start-loading");
		this.emit("did-finish-load");
		this.emit("did-stop-loading");
		return Promise.resolve();
	}

	reload(): void {
		this.emit("did-start-loading");
		this.emit("did-stop-loading");
	}

	canGoBack(): boolean { return false; }
	canGoForward(): boolean { return false; }
	goBack(): void {}
	goForward(): void {}
	openDevTools(options?: unknown): void { this.openedDevTools.push(options); }
	isDestroyed(): boolean { return this.destroyed; }
	destroy(): void { this.destroyed = true; this.emit("destroyed"); }
	getProcessId(): number { return this.id + 1000; }

	capturePage(): Promise<{ toPNG(): Buffer }> {
		return Promise.resolve({ toPNG: () => Buffer.from("png") });
	}
}

class FakeView {
	readonly webContents: FakeWebContents;
	readonly bounds: any[] = [];
	visible = true;
	constructor(id: number) { this.webContents = new FakeWebContents(id); }
	setBounds(bounds: unknown): void { this.bounds.push(bounds); }
	setVisible(visible: boolean): void { this.visible = visible; }
	setBorderRadius(): void {}
}

class FakeContentView {
	readonly children: FakeView[] = [];
	addChildView(view: FakeView): void { if (!this.children.includes(view)) this.children.push(view); }
	removeChildView(view: FakeView): void {
		const index = this.children.indexOf(view);
		if (index >= 0) this.children.splice(index, 1);
	}
}

class FakeWindow {
	readonly contentView = new FakeContentView();
	readonly webContents = new FakeWebContents(1);
	private destroyed = false;
	isDestroyed(): boolean { return this.destroyed; }
}

function fakeElectron() {
	const windows = new WeakMap<FakeWebContents, FakeWindow>();
	const browserWindow = new FakeWindow();
	windows.set(browserWindow.webContents, browserWindow);
	return {
		BrowserWindow: {
			fromWebContents(sender: FakeWebContents): FakeWindow | undefined {
				return windows.get(sender);
			},
		},
		WebContentsView: class extends FakeView {
			constructor(options?: unknown) {
				super(10);
				(viewOptions as any[]).push(options);
			}
		},
		clipboard: {
			texts: [] as string[],
			images: [] as unknown[],
			writeText(value: string) { this.texts.push(value); },
			writeImage(value: unknown) { this.images.push(value); },
		},
		nativeImage: { createFromBuffer(value: Buffer) { return { value }; } },
		_session: { browserWindow, windows },
	};
}

const viewOptions: unknown[] = [];

describe("Cedia Agent native browser bridge", () => {
  it("allows ordinary page links and blocks privileged redirects", async () => {
    const electron = fakeElectron();
    const owner = electron._session.browserWindow.webContents;
    (owner as any).send = () => {};
    const service = createAgentBrowserService({ appRoot: "/tmp/cedia", electron });
    await service.handle({ sender: owner }, "open", { threadId: "thread" });
    const page = electron._session.browserWindow.contentView.children[0]!.webContents;
    expect(isCediaAgentBrowserWebContents(page)).toBe(true);
    expect(isCediaAgentBrowserWebContents(owner)).toBe(false);
    expect(isCediaAgentBrowserWebContents({})).toBe(false);
    let historyAction = "";
    Object.assign(page, { navigationHistory: { canGoBack: () => true, canGoForward: () => true, goBack: () => { historyAction = "back"; }, goForward: () => { historyAction = "forward"; } } });
    await service.handle({ sender: owner }, "goBack", { threadId: "thread" });
    expect(historyAction).toBe("back");
    await service.handle({ sender: owner }, "goForward", { threadId: "thread" });
    expect(historyAction).toBe("forward");
    expect(page.permissionCheck?.()).toBe(false);
    let allowed: boolean | undefined;
    page.permissionRequest?.(page, "media", value => { allowed = value; });
    expect(allowed).toBe(false);
    let blocked = false;
    page.emit("will-navigate", { preventDefault: () => { blocked = true; } }, "https://example.com/next");
    expect(blocked).toBe(false);
    page.emit("will-navigate", { url: "https://example.com/modern", isMainFrame: true, preventDefault: () => { blocked = true; } });
    expect(blocked).toBe(false);
    page.emit("will-redirect", { preventDefault: () => { blocked = true; } }, "file:///etc/passwd");
    expect(blocked).toBe(true);
    blocked = false;
    page.emit("will-redirect", { url: "file:///etc/passwd", isMainFrame: true, preventDefault: () => { blocked = true; } });
    expect(blocked).toBe(true);
    service.dispose();
    expect(isCediaAgentBrowserWebContents(page)).toBe(false);
  });
	it("opens a sandboxed native tab, attaches bounds, and emits state to its owner", async () => {
		const electron = fakeElectron();
		const owner = electron._session.browserWindow.webContents;
		const sent: Array<{ channel: string; state: any }> = [];
		(owner as any).send = (channel: string, state: any) => sent.push({ channel, state });
		const service = createAgentBrowserService({ appRoot: "/tmp/cedia", electron });

		const opened = await service.handle({ sender: owner }, "open", { threadId: "thread-1" }) as any;
		const tab = opened.tabs[0];
		expect(opened.open).toBe(true);
		expect(tab.runtimeSurface).toBe("native");
		const initialView = electron._session.browserWindow.contentView.children[0]!;
		expect(initialView.visible).toBe(false);
		expect(initialView.bounds[0]).toEqual({ x: 0, y: 0, width: 1_280, height: 800 });
		expect(viewOptions[0]).toMatchObject({
		webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
		});

		await service.handle({ sender: owner }, "setPanelBounds", {
			threadId: "thread-1",
			bounds: { x: 4, y: 5, width: 300, height: 200 },
			surface: "native",
		});
		expect(electron._session.browserWindow.contentView.children).toHaveLength(1);
		expect(sent.at(-1)?.channel).toBe("vscode:cediaAgentBrowser");
		expect(sent.at(-1)?.state.tabs[0].status).toBe("live");
		service.dispose();
	});

	it("loads new-tab URLs and reattaches the active native view across tab switches and close", async () => {
		const electron = fakeElectron();
		const owner = electron._session.browserWindow.webContents;
		const service = createAgentBrowserService({ appRoot: "/tmp/cedia", electron });
		const bounds = { x: 12, y: 34, width: 640, height: 420 };

		const opened = await service.handle({ sender: owner }, "open", { threadId: "thread-tabs" }) as any;
		const firstTabId = opened.tabs[0].id;
		await service.handle({ sender: owner }, "setPanelBounds", {
			threadId: "thread-tabs",
			bounds,
			surface: "native",
		});
		const firstView = electron._session.browserWindow.contentView.children[0]!;

		const withSecondTab = await service.handle({ sender: owner }, "newTab", {
			threadId: "thread-tabs",
			url: "https://example.com/next",
			activate: true,
		}) as any;
		const secondTabId = withSecondTab.activeTabId;
		const secondView = electron._session.browserWindow.contentView.children[0]!;
		expect(secondTabId).not.toBe(firstTabId);
		expect(secondView).not.toBe(firstView);
		expect(secondView.webContents.loaded).toContain("https://example.com/next");
		expect(secondView.visible).toBe(true);
		expect(secondView.bounds.at(-1)).toEqual(bounds);
		expect(firstView.visible).toBe(false);

		await service.handle({ sender: owner }, "selectTab", {
			threadId: "thread-tabs",
			tabId: firstTabId,
		});
		expect(firstView.visible).toBe(true);
		expect(firstView.bounds.at(-1)).toEqual(bounds);
		expect(secondView.visible).toBe(false);

		const afterClose = await service.handle({ sender: owner }, "closeTab", {
			threadId: "thread-tabs",
			tabId: firstTabId,
		}) as any;
		expect(afterClose.activeTabId).toBe(secondTabId);
		expect(secondView.visible).toBe(true);
		expect(secondView.bounds.at(-1)).toEqual(bounds);
		const lastClosed = await service.handle({ sender: owner }, "closeTab", {
			threadId: "thread-tabs", tabId: secondTabId,
		}) as any;
		expect(lastClosed.tabs).toEqual([]);
		expect(lastClosed.activeTabId).toBeNull();
		expect(lastClosed.open).toBe(false);
		expect(electron._session.browserWindow.contentView.children).toEqual([]);
		const reopened = await service.handle({ sender: owner }, "open", { threadId: "thread-tabs" }) as any;
		expect(reopened.tabs).toHaveLength(1);
		expect(reopened.open).toBe(true);
		service.dispose();
	});

	it("rejects unsafe URLs while allowing http and https navigation", async () => {
		const electron = fakeElectron();
		const owner = electron._session.browserWindow.webContents;
		const service = createAgentBrowserService({ appRoot: "/tmp/cedia", electron });
		const state = await service.handle({ sender: owner }, "open", { threadId: "thread-2" }) as any;
		const tabId = state.tabs[0].id;

		await expect(service.handle({ sender: owner }, "navigate", { threadId: "thread-2", tabId, url: "https://example.com" })).resolves.toMatchObject({ tabs: [{ url: "https://example.com/" }] });
		await expect(service.handle({ sender: owner }, "navigate", { threadId: "thread-2", tabId, url: "file:///etc/passwd" })).rejects.toThrow("Only http(s) browser URLs are allowed");
		await expect(service.handle({ sender: owner }, "navigate", { threadId: "thread-2", tabId, url: "javascript:alert(1)" })).rejects.toThrow("Only http(s) browser URLs are allowed");
		service.dispose();
	});

	it("does not surface subframe or aborted navigation failures as page errors", async () => {
		const electron = fakeElectron();
		const owner = electron._session.browserWindow.webContents;
		const service = createAgentBrowserService({ appRoot: "/tmp/cedia", electron });
		const opened = await service.handle({ sender: owner }, "open", { threadId: "thread-errors" }) as any;
		const tabId = opened.tabs[0].id;
		const page = electron._session.browserWindow.contentView.children[0]!.webContents;

		// Electron versions that omit the frame flag for a subframe must not
		// overwrite a healthy top-level page with the generic error overlay.
		page.emit("did-fail-load", -105, "name not resolved", "https://example.com/frame", undefined);
		await expect(service.handle({ sender: owner }, "getState", { threadId: "thread-errors" })).resolves.toMatchObject({
			lastError: null,
			tabs: [{ id: tabId, lastError: null }],
		});

		// A superseded load is expected during normal address-bar navigation.
		page.emit("did-fail-load", -3, "aborted", "https://example.com", true);
		await expect(service.handle({ sender: owner }, "getState", { threadId: "thread-errors" })).resolves.toMatchObject({
			lastError: null,
			tabs: [{ id: tabId, lastError: null }],
		});
		page.emit("did-fail-load", "ERR_ABORTED", "aborted", "https://example.com", true);
		await expect(service.handle({ sender: owner }, "getState", { threadId: "thread-errors" })).resolves.toMatchObject({
			lastError: null,
			tabs: [{ id: tabId, lastError: null }],
		});

		service.dispose();
	});

	it("routes renderer calls and state subscriptions through the Cedia channel", async () => {
		const calls: Array<{ channel: string; input: any }> = [];
		const listeners = new Map<string, Set<Listener>>();
		const bridge = {
			invoke: async (channel: string, input: any) => {
				calls.push({ channel, input });
				return { threadId: input.input?.threadId ?? "thread-3", version: 1, open: true, activeTabId: null, tabs: [], lastError: null };
			},
			on: (channel: string, listener: Listener) => {
				const set = listeners.get(channel) ?? new Set<Listener>();
				set.add(listener);
				listeners.set(channel, set);
			},
			removeListener: (channel: string, listener: Listener) => listeners.get(channel)?.delete(listener),
		};
		const api = createNativeBrowserApi(bridge);
		const states: any[] = [];
		const unsubscribe = api.onState((state) => states.push(state));
		await api.open({ threadId: ThreadId.makeUnsafe("thread-3") });
		for (const listener of listeners.get("vscode:cediaAgentBrowser") ?? []) listener({}, { threadId: "thread-3", version: 2 });
		unsubscribe();
		expect(calls[0]).toMatchObject({ channel: "vscode:cediaAgent", input: { kind: "panel", surface: "browser", method: "open" } });
		expect(states).toEqual([{ threadId: "thread-3", version: 2 }]);
	});

	it("releases native views when the owning window is destroyed", async () => {
		const electron = fakeElectron();
		const owner = electron._session.browserWindow.webContents;
		const service = createAgentBrowserService({ appRoot: "/tmp/cedia", electron });
		await service.handle({ sender: owner }, "open", { threadId: "thread-4" });
		expect(electron._session.browserWindow.contentView.children).toHaveLength(1);
		owner.emit("destroyed");
		(electron._session.browserWindow as any).destroyed = true;
		expect(electron._session.browserWindow.contentView.children).toHaveLength(0);
		await expect(service.handle({ sender: owner }, "getState", { threadId: "thread-4" })).rejects.toThrow();
		service.dispose();
	});
});
