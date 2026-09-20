/**
 * Deterministic trusted extension used by scripts/omp-virtual-ui-smoke.ts.
 *
 * It deliberately exercises OMP's own in-process extension UI and native bash
 * implementation.  The fixture has no network/provider access and writes no
 * state; the smoke driver observes the framed terminal and transcript events.
 */
export default function (api: any) {
	const component = (label: string, done: (value: string) => void) => ({
		render: () => [label],
		handleInput: (data: string) => {
			if (data === `${label}-ok`) done(data);
		},
	});

	api.on("session_start", async (_event: unknown, ctx: any) => {
		await ctx.ui.custom((_tui: unknown, _theme: unknown, _keys: unknown, done: (value: string) => void) =>
			component("cedia-virtual-startup", done),
		);
		// Exercise the real in-process CustomEditor seam after the startup modal
		// gives focus back to the editor. The microtask observes the text after
		// TUI has routed the same input byte to the focused editor component.
		ctx.ui.setEditorText("cedia-virtual-editor");
		ctx.ui.onTerminalInput((data: string) => {
			if (data === "!") {
				queueMicrotask(() => ctx.ui.notify(`cedia-virtual-editor-text:${ctx.ui.getEditorText()}`, "info"));
			}
		});
		ctx.ui.notify("cedia-virtual-startup-complete", "info");
	});

	api.registerCommand("cedia-virtual-ui-command", {
		description: "Deterministic Cedia virtual UI command",
		handler: async (_args: string, ctx: any) => {
			await ctx.ui.custom((_tui: unknown, _theme: unknown, _keys: unknown, done: (value: string) => void) =>
				component("cedia-virtual-command", done),
			);
			ctx.ui.notify("cedia-virtual-command-complete", "info");
		},
	});

	// Re-register the native built-in under the same name so OMP exposes the
	// same-tool invokeTool delegation that the production wrapper uses.  The
	// delegated native tool receives pty:true and owns the actual PtySession.
	api.registerTool({
		name: "bash",
		label: "Bash (Cedia fixture wrapper)",
		description: "Cedia fixture wrapper around OMP's native bash",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string" },
				pty: { type: "boolean" },
			},
			required: ["command"],
			additionalProperties: false,
		},
		approval: "exec",
		loadMode: "eager",
		execute: async (
			_toolCallId: string,
			params: Record<string, unknown>,
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: any,
		) => {
			const native = await ctx.invokeTool?.(params);
			if (native) return native;
			return { content: [{ type: "text", text: "cedia fixture invokeTool unavailable" }], details: { unavailable: true } };
		},
	});
}
