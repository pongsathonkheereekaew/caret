/** Local render fixture for the real Caret Agents shell.
 *
 * Renders `createTaskWebviewHtml` with a synthetic host snapshot so the shell
 * can be inspected and screenshotted without a host, an OMP session, or a
 * provider call. The stub only replaces `acquireVsCodeApi`; every DOM node and
 * style rule comes from the shipped webview source, so a defect seen here is a
 * defect in the shell itself.
 */

import { composerAxesFromTask, resolveComposerControls } from "../apps/macos/src/composer-runtime.ts";
import { createTaskWebviewHtml } from "../apps/macos/src/webview.ts";

const NONCE = "caret-shell-fixture";

const now = "2026-09-14T00:00:00.000Z";

const project = {
	id: "p-demo",
	path: "/tmp/caret-ui-review-20260914/workspace",
	name: "demo-repo",
	pinned: false,
	archived: false,
	createdAt: now,
};

const projects = [
	project,
	{ id: "p-api", path: "/tmp/caret-ui-review-20260914/api", name: "caret-api", pinned: false, archived: false, createdAt: now },
];

const session = {
	id: "s-1",
	projectId: "p-demo",
	title: "Add request retry to the sync client",
	cwd: project.path,
	sessionFile: "/tmp/session.jsonl",
	incarnation: "inc-1",
	status: "idle" as "idle" | "running" | "stopped",
	archived: false,
	createdAt: now,
	updatedAt: now,
};

const sessions = [
	session,
	{ ...session, id: "s-2", title: "Fix flaky terminal resize", status: "running" as const, updatedAt: now },
	{ ...session, id: "s-3", title: "Write release notes", status: "stopped" as const, archived: true },
];

function sessionsWith(status: "idle" | "running" | "stopped") {
	return [session, ...sessions.slice(1)].map((row) => (row.id === session.id ? { ...row, status } : row));
}

const models = [
	{ id: "fixture-model", provider: "fixture", label: "Fixture Model", available: true },
	{ id: "fixture-model-mini", provider: "fixture", label: "Fixture Model Mini", available: true },
];

function baseState() {
	return {
		connection: "connected" as const,
		lastError: undefined as string | undefined,
		project,
		projects,
		sessions,
		session,
		transcript: [] as unknown[],
		cursor: 0,
		hasMoreEvents: false,
		uiRequests: [] as unknown[],
		pendingCommands: {} as Record<string, unknown>,
		models,
		selectedModel: "fixture-model",
		loginProviders: [{ id: "fixture", name: "Fixture provider", available: true, authenticated: true }],
		presentations: [],
		slashCommands: [{ name: "plan", description: "Draft a plan" }],
		draft: "",
		drafts: {} as Record<string, string>,
		workbenchMode: "agents" as const,
		transcriptScrolls: {},
		followLatest: true,
		workPanel: {
			open: false,
			activeTab: "changes" as const,
			position: "right" as const,
			preferredWidth: 360,
			preferredHeight: 320,
			resources: [],
			taskKey: "s-1",
		},
		attachments: [] as unknown[],
		plan: { advertised: false, steps: [], goals: [], subagents: [] },
		workResources: [] as unknown[],
		workTabs: [] as unknown[],
	};
}

function message(id: string, role: "user" | "assistant", text: string, status: "streaming" | "completed") {
	return { id, kind: "message", role, text, status, rawFrames: [] };
}

function tool(id: string, toolName: string, toolStatus: string, args: unknown, output: string, status: "streaming" | "completed") {
	return { id, kind: "tool", role: "tool", text: toolName, status, toolName, toolStatus, args, output, rawFrames: [] };
}

function fixtureState(name: string) {
	const state = baseState();
	if (name === "empty") return state;

	state.session = { ...session, status: "running" as const };
	state.sessions = sessionsWith("running");

	state.transcript = [
		message("m-1", "user", "Add retry with backoff to the sync client, and cover the 429 path with a test.", "completed"),
		message(
			"m-2",
			"assistant",
			"I found the client in src/sync/client.ts. It retries nothing today, so a 429 from the API surfaces straight to the caller. I will add a bounded retry with jitter, then a test that fails fast on the first 429 and succeeds on the second attempt.",
			"completed",
		),
		tool("t-1", "read_file", "completed", { path: "src/sync/client.ts" }, "export async function syncOnce(payload: SyncPayload) {\n  const response = await fetch(endpoint, { method: 'POST', body: ... });\n  return response.json();\n}", "completed"),
		tool("t-2", "edit_file", "running", { path: "src/sync/client.ts", action: "insert" }, "", "streaming"),
		message("m-3", "assistant", "Editing the request path now:", "streaming"),
	];
	state.draft = "";

	if (name === "approval") {
		state.uiRequests = [
			{
				kind: "interactive",
				token: "tok-1",
				request: {
					method: "confirm",
					id: "req-1",
					title: "Run command",
					message: "Run `bun test src/sync` in /tmp/caret-ui-review-20260914/workspace?",
					scopes: ["bash"],
					dangerous: false,
				},
				sessionId: "s-1",
				incarnation: "inc-1",
				cwd: project.path,
				tool: "bash",
				target: "bun test src/sync",
				status: "pending",
			},
		];
	}

	if (name === "panel") {
		state.workPanel = { ...state.workPanel, open: true };
		state.workResources = [
			{ id: "r-1", kind: "diff", label: "src/sync/client.ts", taskKey: "s-1", status: "ready" },
			{ id: "r-2", kind: "terminal", label: "bun test", taskKey: "s-1", status: "running" },
		];
		state.workTabs = [
			{ id: "changes", label: "Changes", available: true },
			{ id: "terminal", label: "Terminal", available: true },
			{ id: "browser", label: "Browser", available: false, reason: "No browser bridge for this host." },
			{ id: "artifacts", label: "Artifacts", available: true },
		];
	}

	return state;
}

function withComposer(state: ReturnType<typeof baseState>) {
	const axes = composerAxesFromTask(state as never, { attachmentsReady: 0, attachmentsPending: 0, attachmentsFailed: 0 });
	return { ...state, composer: resolveComposerControls(axes) };
}

function renderPage(name: string): string {
	const fixture = JSON.stringify(withComposer(fixtureState(name)));
	const html = createTaskWebviewHtml({ cspSource: "" }, NONCE);
	const stub = `<script nonce="${NONCE}">
window.__caretPosted = [];
window.acquireVsCodeApi = function () {
  return { postMessage: function (message) { window.__caretPosted.push(message); }, getState: function () { return undefined; }, setState: function () {} };
};
window.__caretFixture = ${fixture};
</script>`;
	const boot = `<script nonce="${NONCE}">
setTimeout(function () { window.postMessage({ type: "state", state: window.__caretFixture }, "*"); }, 0);
</script>`;
	return html.replace("<body>", `<body>${stub}`).replace("</body>", `${boot}</body>`);
}

const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch(request) {
		const url = new URL(request.url);
		const name = url.searchParams.get("fixture") ?? "empty";
		return new Response(renderPage(name), {
			headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
		});
	},
});

console.log(`Caret shell render fixture: http://127.0.0.1:${server.port}/?fixture=empty`);
console.log(`Other fixtures: ${["running", "approval", "panel"].map((n) => `http://127.0.0.1:${server.port}/?fixture=${n}`).join(" ")}`);
process.once("SIGTERM", () => {
	server.stop(true);
	process.exitCode = 0;
});
