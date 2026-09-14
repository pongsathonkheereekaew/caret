import { describe, expect, it } from "bun:test";
import { parseMarkdownTable } from "../src/markdown-table.ts";

describe("parseMarkdownTable", () => {
	it("parses a 2-col GFM table and keeps cells as plain strings", () => {
		const table = parseMarkdownTable(`
| Name | Age |
| --- | --- |
| Ada | 36 |
| Bob | 41 |
`);
		expect(table).toEqual({
			headers: ["Name", "Age"],
			rows: [
				["Ada", "36"],
				["Bob", "41"],
			],
		});
	});

	it("does not treat prose with a pipe as a table", () => {
		expect(parseMarkdownTable("Choose left | right and continue.")).toBeUndefined();
		expect(parseMarkdownTable("single line")).toBeUndefined();
	});

	it("does not treat the alignment row as a data row", () => {
		const table = parseMarkdownTable("| A | B |\n| :---: | ---: |\n| 1 | 2 |");
		expect(table?.headers).toEqual(["A", "B"]);
		expect(table?.rows).toEqual([["1", "2"]]);
		expect(table?.rows.some((row) => row.some((cell) => SEPARATOR_LOOKALIKE.test(cell)))).toBe(false);
	});

	it("returns undefined for separator-only text", () => {
		expect(parseMarkdownTable("| --- | --- |")).toBeUndefined();
		expect(parseMarkdownTable("--- | ---")).toBeUndefined();
	});

	it("does not execute HTML in cells", () => {
		const table = parseMarkdownTable("| X |\n| --- |\n| <img src=x onerror=alert(1)> |");
		expect(table?.rows).toEqual([["<img src=x onerror=alert(1)>"]]);
	});
});

const SEPARATOR_LOOKALIKE = /^:?-{3,}:?$/;
