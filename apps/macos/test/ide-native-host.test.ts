import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startHostServer } from "../../host/src/server.ts";
import { CaretHostClient } from "../src/api.ts";
import { installVscodeStub, stubState, stubUri } from "./helpers/vscode-stub.ts";

/*
 * The only test in this repository that activates the Mac extension against a
 * real Caret host.
 *
 * The other behavioural tests use an unreachable host, which proves the
 * surface degrades honestly but says nothing about the connected path. This one
 * starts the actual host server on a private loopback descriptor, seeds a
 * project through the real client, and checks that the workbench citizen
 * reflects the live connection instead of a placeholder.
 *
 * No OMP process is started: the host only spawns the agent runtime when a
 * session starts, and this slice stays at the project/connection surface.
 */

const vscodeApi: any = installVscodeStub();

// The host stores canonical paths, so the stub's workspace root must be
// canonical too or the extension will not match the open folder to a project.
const root = realpathSync(mkdtempSync(join(tmpdir(), "caret-ide-host-")));
const stateDir = join(root, "host");
const workspace = join(root, "workspace");
mkdirSync(stateDir, { recursive: true });
mkdirSync(join(workspace, "src"), { recursive: true });

let server: Awaited<ReturnType<typeof startHostServer>>;
let client: CaretHostClient;
let projectId = "";
let projectName = "";

beforeAll(async () => {
	server = await startHostServer({ stateDir });
	// Seed through the real client so the whole client -> router -> store path
	// runs, not just the test's own HTTP calls.
	client = await CaretHostClient.fromStateDir(stateDir, { requirePrivateMode: true });
	const project = await client.createProject(workspace, "ide-native-fixture");
	projectId = project.id;
	projectName = project.name;
});

afterAll(async () => {
	await server.close();
	rmSync(root, { recursive: true, force: true });
});

stubState.workspaceRoot = workspace;
stubState.config.set("caret.hostStateDir", stateDir);
// Empty host paths mean the extension may not start a helper; it must reach the
// host through the descriptor the server already published.
stubState.config.set("caret.hostNodePath", "");
stubState.config.set("caret.hostScriptPath", "");

const extension: any = await import("../src/extension.ts");

function context(): any {
	return {
		extensionPath: join(root, "extension"),
		extensionUri: stubUri(`file://${join(root, "extension")}`),
		globalStorageUri: stubUri(`file://${join(root, "globalStorage", "caret.caret")}`),
		storageUri: stubUri(`file://${join(root, "workspaceStorage")}`),
		subscriptions: [],
		globalState: { get: (_key: string, fallback: unknown) => fallback, update: async () => {}, keys: () => [] },
		workspaceState: { get: (_key: string, fallback: unknown) => fallback, update: async () => {}, keys: () => [] },
		extension: { id: "caret.caret", packageJSON: { name: "caret", publisher: "caret", version: "0.1.0" } },
	};
}

function resolveViews(): void {
	for (const entry of stubState.views) {
		entry.provider.resolveWebviewView({
			webview: {
				html: "",
				options: {},
				cspSource: "",
				asWebviewUri: (uri: unknown) => uri,
				postMessage: async (message: unknown) => {
					stubState.posted.push(message);
					return true;
				},
				onDidReceiveMessage: () => ({ dispose() {} }),
			},
			onDidDispose: () => ({ dispose() {} }),
			onDidChangeVisibility: () => ({ dispose() {} }),
			show() {},
		});
	}
}

function snapshots(): { state?: Record<string, any> }[] {
	return stubState.posted.filter((message): message is { state?: Record<string, any> } => (message as { type?: string }).type === "snapshot");
}

/** The connection flips to "connected" before projects are listed, so always
 * read the newest snapshot rather than the first one that says connected. */
function latestSnapshot(): Record<string, any> | undefined {
	return snapshots().at(-1)?.state;
}

async function waitForConnected(timeoutMs = 4_000): Promise<Record<string, any> | undefined> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const state = latestSnapshot();
		if (state && (state.connection === "connected" || state.connection === "running")) return state;
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	return undefined;
}

async function waitForProject(name: string, timeoutMs = 4_000): Promise<Record<string, any> | undefined> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const state = latestSnapshot();
		const names = ((state?.projects ?? []) as readonly { name?: string }[]).map(project => project.name);
		if (names.includes(name)) return state;
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	return undefined;
}

describe("ide-native surface with a live host", () => {
	it("reports the real connection instead of a placeholder", async () => {
		extension.activate(context());
		resolveViews();
		const state = await waitForConnected();
		expect(state).toBeDefined();
		// The status bar must show the state the host actually reported.
		const item = stubState.statusItems.at(-1)!;
		expect(item.text).toContain("Caret ready");
		expect(item.visible).toBe(true);
		expect(item.command).toBe("caret.showAgents");
		expect(vscodeApi).toBeDefined();
	});

	it("surfaces a project the host really stores", async () => {
		const state = await waitForProject(projectName);
		expect(state).toBeDefined();
		const projects = (state!.projects ?? []) as readonly { name?: string }[];
		expect(projects.map(project => project.name)).toContain(projectName);
		// A real task surface exists, so the editor/explorer menus may appear.
		expect(stubState.context.at(-1)).toEqual({ key: "caret.taskAvailable", value: true });
	});

	it("does not need to spawn a host helper when the descriptor is live", async () => {
		// Empty host paths would raise HostSetupRequiredError if the client had
		// needed to start one, so a connected state proves the descriptor path.
		const state = await waitForConnected(1_000);
		expect(state?.connection).toBe("connected");
		expect(stubState.statusMessages.some(message => message.includes("host helper"))).toBe(false);
	});

	it("lists a task the host really stores", async () => {
		const created = await client.createSession({ projectId, title: "Retry the sync client" });
		await stubState.commands.get("caret.refresh")!();
		const deadline = Date.now() + 4_000;
		let titles: (string | undefined)[] = [];
		while (Date.now() < deadline) {
			const state = latestSnapshot();
			titles = ((state?.sessions ?? []) as readonly { title?: string }[]).map(session => session.title);
			if (titles.includes("Retry the sync client")) break;
			await new Promise(resolve => setTimeout(resolve, 50));
		}
		expect(titles).toContain("Retry the sync client");
		// The task the host minted is the one the client renders, not a local guess.
		const listed = await client.listSessions(projectId);
		expect(listed.map(session => session.id)).toContain(created.id);
	});

	it("pairs a device through the host and shows a real QR code", async () => {
		vscodeApi.window.showInputBox = async () => "Test iPhone";
		await stubState.commands.get("caret.pairDevice")!();
		const panel = stubState.panels.at(-1);
		expect(panel).toBeDefined();
		expect(panel!.title).toBe("Pair iPhone");
		// A real QR data URL, not a placeholder image.
		expect(panel!.webview.html).toContain("data:image/png;base64,");
		const devices = await client.listDevices();
		expect(devices.map(device => device.name)).toContain("Test iPhone");
	});

	it("offers native code actions once a real task surface exists", () => {
		// Runs after the activation above, like the project/task tests: the
		// provider is registered during activate().
		const provider = stubState.codeActions.at(-1);
		expect(provider).toBeDefined();
		const document = { uri: stubUri(`file://${join(workspace, "src", "greet.ts")}`) };
		const selection = provider!.provider.provideCodeActions(document, { isEmpty: false });
		expect(selection.map((action: { command?: { command: string } }) => action.command?.command))
			.toEqual(["caret.explainSelection", "caret.fixSelection", "caret.inlineEdit", "caret.addSelectionToTask", "caret.reviewInDiff"]);
		// With no selection the file action survives; the selection actions do not.
		const cursor = provider!.provider.provideCodeActions(document, { isEmpty: true });
		expect(cursor.map((action: { command?: { command: string } }) => action.command?.command))
			.toEqual(["caret.reviewInDiff"]);
		// A virtual document (the review original) never gets a file-space action.
		const virtual = provider!.provider.provideCodeActions({ uri: stubUri("caret-review:/HEAD/src/greet.ts") }, { isEmpty: false });
		expect(virtual).toEqual([]);
	});
});
