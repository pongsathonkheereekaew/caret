/**
 * Terminal engines for the conformance corpus.
 *
 * The workbench renders its terminals with xterm.js from the pinned Code-OSS base,
 * so `xterm` is the engine Caret ships today and the one the corpus must hold.
 * `ghostty` is optional: it loads `@coder/libghostty-vt-node` (the libghostty-vt
 * Node-API binding, measured in docs/maintenance/evidence/terminal-vt-spike-2026-09-16/)
 * only when that package is installed, so the corpus can be run against a candidate
 * engine without making it a dependency of the repository.
 */

import type { TerminalEngine, TerminalScreen, TerminalSurface } from "../../apps/macos/src/terminal-conformance.ts";

/** xterm.js headless - the same VT engine the workbench terminal runs. */
export async function createXtermEngine(scrollback = 2000): Promise<TerminalEngine> {
	const mod = await import("@xterm/headless");
	const headless = (mod as { default?: { Terminal: unknown } }).default ?? (mod as unknown as { Terminal: unknown });
	const Terminal = (headless as { Terminal: new (options: Record<string, unknown>) => XtermHeadless }).Terminal;
	return {
		name: "xterm.js",
		async open(cols: number, rows: number): Promise<TerminalSurface> {
			const term = new Terminal({ cols, rows, scrollback, allowProposedApi: true });
			return {
				write: (data: string) => new Promise<void>(resolve => term.write(data, () => resolve())),
				screen: async (): Promise<TerminalScreen> => {
					const buffer = term.buffer.active;
					const top = buffer.viewportY ?? buffer.baseY;
					const lines: string[] = [];
					for (let index = 0; index < rows; index++) {
						const line = buffer.getLine(top + index);
						const text = line ? line.translateToString(true).replace(/\s+$/, "") : "";
						if (text) lines.push(text);
					}
					return { rows: lines, cursorX: buffer.cursorX, cursorY: buffer.cursorY };
				},
				dispose: () => term.dispose(),
			};
		},
	};
}

/** libghostty-vt (Ghostty's parser and terminal state) through its Node-API binding. */
export async function createGhosttyEngine(scrollback = 2000): Promise<TerminalEngine | undefined> {
	// Built at runtime so nothing in the repository depends on the package: the corpus
	// must run without it, and a static specifier would also fail the type check here.
	const specifier = "@coder/libghostty-vt-node";
	let mod: { createTerminal?: unknown; getNativeInfo?: unknown };
	try {
		mod = (await import(specifier)) as { createTerminal?: unknown; getNativeInfo?: unknown };
	} catch {
		return undefined;
	}
	const createTerminal = mod.createTerminal as ((options: Record<string, unknown>) => GhosttyTerminal) | undefined;
	if (typeof createTerminal !== "function") {
		return undefined;
	}
	return {
		name: "libghostty-vt",
		async open(cols: number, rows: number): Promise<TerminalSurface> {
			const terminal = createTerminal({ cols, rows, scrollbackLimit: scrollback });
			return {
				write: async (data: string) => { terminal.feed(data); },
				screen: async (): Promise<TerminalScreen> => {
					const snapshot = terminal.snapshot();
					const lines = snapshot.visibleLines.map(line => line.text.replace(/\s+$/, "")).filter(Boolean);
					return { rows: lines, cursorX: snapshot.cursorCol, cursorY: snapshot.cursorRow };
				},
				dispose: () => terminal.dispose(),
			};
		},
	};
}

interface XtermHeadless {
	write(data: string, callback: () => void): void;
	dispose(): void;
	buffer: { active: { viewportY?: number; baseY: number; cursorX: number; cursorY: number; getLine(index: number): { translateToString(trimRight?: boolean): string } | undefined } };
}

interface GhosttyTerminal {
	feed(data: string): void;
	snapshot(): { cursorRow: number; cursorCol: number; visibleLines: { text: string }[] };
	dispose(): void;
}
