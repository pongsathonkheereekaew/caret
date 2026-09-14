import { describe, expect, it } from "bun:test";
import {
	MENTION_LOGS_REASON,
	MENTION_NO_SELECTION_REASON,
	MENTION_UPLOAD_REASON,
	mentionRows,
} from "../src/mention-context.ts";

describe("mentionRows", () => {
	it("filters by query against label, path, and title", () => {
		const rows = mentionRows({
			query: "NOTE",
			files: [{ path: "README.md" }, { path: "notes.txt" }, { path: "src/index.ts" }],
			sessions: [{ id: "s1", title: "Notebook polish" }, { id: "s2", title: "Other" }],
			artifacts: [{ sha256: "aaa", name: "note.png" }, { sha256: "bbb", name: "shot.jpg" }],
		});
		expect(rows.filter((row) => row.kind === "file").map((row) => row.id)).toEqual(["notes.txt"]);
		expect(rows.filter((row) => row.kind === "session").map((row) => row.id)).toEqual(["s1"]);
		expect(rows.filter((row) => row.kind === "artifacts").map((row) => row.id)).toEqual(["aaa"]);
		expect(rows.some((row) => row.id === "README.md" || row.id === "s2" || row.id === "bbb")).toBe(false);
		expect(mentionRows({
			query: "s2",
			sessions: [{ id: "s2", title: "Other" }],
		}).some((row) => row.kind === "session" && row.id === "s2")).toBe(true);
	});

	it("disables selection when the window has no editor selection", () => {
		const row = mentionRows({}).find((item) => item.kind === "selection");
		expect(row).toMatchObject({
			id: "selection",
			kind: "selection",
			label: "Selection",
			enabled: false,
			reason: MENTION_NO_SELECTION_REASON,
			action: "unavailable",
		});
		expect(row?.insert).toBeUndefined();
	});

	it("enables selection and inserts a trimmed 80-character preview", () => {
		const preview = `  ${"p".repeat(90)}  `;
		const row = mentionRows({
			hasSelection: true,
			selectionPreview: preview,
		}).find((item) => item.kind === "selection");
		expect(row).toMatchObject({
			id: "selection",
			enabled: true,
			action: "insert",
			insert: "p".repeat(80),
		});
		expect(row?.reason).toBeUndefined();
		expect(row?.insert?.length).toBe(80);
	});

	it("states path-reference upload reason when upload is not advertised", () => {
		const hidden = mentionRows({ files: [{ path: "apps/macos/src/webview.ts" }] }).find((row) => row.kind === "file");
		expect(hidden).toMatchObject({
			kind: "file",
			label: "apps/macos/src/webview.ts",
			insert: "@apps/macos/src/webview.ts",
			enabled: true,
			action: "attach_path",
			reason: MENTION_UPLOAD_REASON,
		});
		expect(mentionRows({
			files: [{ path: "apps/macos/src/webview.ts" }],
			uploadAdvertised: false,
		}).find((row) => row.kind === "file")?.reason).toBe(MENTION_UPLOAD_REASON);
		expect(mentionRows({
			files: [{ path: "apps/macos/src/webview.ts" }],
			uploadAdvertised: true,
		}).find((row) => row.kind === "file")?.reason).toBeUndefined();
	});

	it("includes the Terminal logs row without treating it as a user PTY", () => {
		const row = mentionRows({}).find((item) => item.kind === "logs");
		expect(row).toEqual({
			id: "terminal",
			kind: "logs",
			label: "Logs",
			enabled: true,
			reason: MENTION_LOGS_REASON,
			action: "open_work_tab",
		});
	});

	it("never claims a file was uploaded and does not invent Cloud or voice rows", () => {
		const rows = mentionRows({
			query: "",
			files: [{ path: "secret.png" }],
			sessions: [{ id: "s1", title: "Attach work" }],
			artifacts: [{ sha256: "abc", name: "build.zip" }],
			hasSelection: true,
			selectionPreview: "const x = 1",
			uploadAdvertised: false,
		});
		const serialized = JSON.stringify(rows).toLowerCase();
		expect(serialized).not.toContain("uploaded");
		expect(rows.some((row) => /cloud|voice|unlimited/i.test(`${row.label} ${row.reason ?? ""} ${row.insert ?? ""}`))).toBe(false);
		expect(rows.some((row) => row.kind === "folder")).toBe(false);
		expect(rows.filter((row) => row.kind === "file")).toHaveLength(1);
		expect(rows.find((row) => row.kind === "session")).toMatchObject({ insert: "@Attach work", action: "insert" });
		expect(rows.find((row) => row.kind === "artifacts")).toMatchObject({ insert: "@build.zip", action: "insert", enabled: true });
	});

	it("returns stubs plus capped files, sessions, and artifacts when the query is empty", () => {
		const files = Array.from({ length: 10 }, (_, index) => ({ path: `f${index}.ts` }));
		const sessions = Array.from({ length: 8 }, (_, index) => ({ id: `s${index}`, title: `Session ${index}` }));
		const artifacts = Array.from({ length: 6 }, (_, index) => ({ sha256: `h${index}`, name: `art${index}.bin` }));
		const rows = mentionRows({ files, sessions, artifacts });
		expect(rows.filter((row) => row.kind === "selection")).toHaveLength(1);
		expect(rows.filter((row) => row.kind === "logs")).toHaveLength(1);
		expect(rows.filter((row) => row.kind === "file")).toHaveLength(8);
		expect(rows.filter((row) => row.kind === "session")).toHaveLength(6);
		expect(rows.filter((row) => row.kind === "artifacts")).toHaveLength(4);
	});

	it("lists unique parent folders as path references without claiming upload", () => {
		const rows = mentionRows({
			query: "macos",
			files: [{ path: "apps/macos/src/webview.ts" }, { path: "apps/macos/src/extension.ts" }, { path: "README.md" }],
		});
		const folders = rows.filter((row) => row.kind === "folder");
		expect(folders.map((row) => row.id)).toEqual(["apps/macos", "apps/macos/src"]);
		expect(folders[0]).toMatchObject({
			insert: "@apps/macos",
			action: "attach_path",
			reason: MENTION_UPLOAD_REASON,
		});
	});
});
