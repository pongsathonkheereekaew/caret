import { describe, expect, it } from "bun:test";

// Loaded dynamically so the pinned desktop sources are exercised at runtime
// without pulling that whole tree into this package's typecheck.
const desktop = new URL("../../../desktop/src/vs/", import.meta.url);
const { KeybindingResolver, ResultKind } = (await import(new URL("platform/keybinding/common/keybindingResolver.ts", desktop).href)) as {
	KeybindingResolver: new (defaults: unknown[], overrides: unknown[], log: (str: string) => void) => { resolve(context: unknown, chords: string[], keypress: string): { kind: number; commandId?: string | null } };
	ResultKind: { KbFound: number; MoreChordsNeeded: number; NoMatchingKb: number };
};
const { ContextKeyExpr } = (await import(new URL("platform/contextkey/common/contextkey.ts", desktop).href)) as {
	ContextKeyExpr: { has(key: string): unknown; and(...expr: unknown[]): unknown };
};

/** Structurally faithful keybinding items. Building a real ResolvedKeybinding
 * needs the OS layout service, but KeybindingResolver only reads chords, when,
 * command, commandArgs, and bubble — so the real resolver runs unmodified. */
type Item = {
	readonly chords: readonly string[];
	readonly command: string;
	readonly when: unknown;
	readonly bubble: boolean;
	readonly commandArgs: unknown;
};

function item(command: string, chords: readonly string[], when: unknown): Item {
	return { chords, command, when, bubble: false, commandArgs: undefined };
}

function context(values: Record<string, boolean>): { getValue(key: string): unknown } {
	return { getValue: (key: string) => values[key] };
}

/** The registry sorts ascending by weight: built-in (200) before extension
 * (400), so extension-contributed items come last. `_findCommand` returns the
 * last match, which is why a scoped single-chord extension binding wins. */
function resolver(defaults: readonly Item[]): { resolve(context: unknown, chords: string[], keypress: string): { kind: number; commandId?: string | null } } {
	return new KeybindingResolver(defaults as never, [] as never, () => {});
}

describe("Cmd+K resolves to Caret inline edit", () => {
	const caretBinding = item(
		"caret.inlineEdit",
		["cmd+k"],
		ContextKeyExpr.and(ContextKeyExpr.has("editorHasSelection"), ContextKeyExpr.has("editorTextFocus")),
	);
	// Real built-in shortcuts that begin with Cmd+K.
	const builtInChords = [
		item("workbench.action.openWorkspace", ["cmd+k", "cmd+o"], ContextKeyExpr.has("editorTextFocus")),
		item("workbench.action.selectTheme", ["cmd+k", "cmd+t"], undefined),
		item("editor.action.rename", ["cmd+k", "f2"], ContextKeyExpr.has("editorTextFocus")),
	];

	it("fires the single-chord Caret binding when a selection exists", () => {
		const kb = resolver([...builtInChords, caretBinding]);
		const result = kb.resolve(context({ editorHasSelection: true, editorTextFocus: true }) as never, [], "cmd+k");
		expect(result.kind).toBe(ResultKind.KbFound);
		expect(result.kind === ResultKind.KbFound && result.commandId).toBe("caret.inlineEdit");
	});

	it("still waits for the chord when there is no selection", () => {
		const kb = resolver([...builtInChords, caretBinding]);
		const result = kb.resolve(context({ editorHasSelection: false, editorTextFocus: true }) as never, [], "cmd+k");
		// Caret's when-clause does not match, so the built-in chord prefix wins.
		expect(result.kind).toBe(ResultKind.MoreChordsNeeded);
	});
});

describe("line-number gutter menu is a live surface", () => {
	it("is rendered by the pinned workbench and normalizes the selection", async () => {
		const { readFileSync } = await import("node:fs");
		const source = readFileSync(
			new URL("../../../desktop/src/vs/workbench/contrib/codeEditor/browser/editorLineNumberMenu.ts", import.meta.url),
			"utf8",
		);
		// The menu must actually be created from the line-number context menu id.
		expect(source).toContain("createMenu(MenuId.EditorLineNumberContext, contextKeyService)");
		// VS Code selects the clicked line before showing the menu, so a Caret
		// command registered on that menu always sees a real selection.
		expect(source).toContain("this.editor.setSelection(lineRange, TextEditorSelectionSource.PROGRAMMATIC)");
		// It forwards the line number and uri to contributed commands.
		expect(source).toContain("shouldForwardArgs: true");
	});
});
