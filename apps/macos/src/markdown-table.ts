/** D06 transcript tables are real GFM tables. Cells stay plain strings — no HTML execution. */

export interface MarkdownTable {
	readonly headers: readonly string[];
	readonly rows: readonly (readonly string[])[];
}

const SEPARATOR_CELL = /^:?-{3,}:?$/;

export function parseMarkdownTable(text: string): MarkdownTable | undefined {
	const lines = normalizeTableLines(text);
	if (lines.length < 2) return undefined;

	const headers = splitTableRow(lines[0]);
	if (!headers || headers.length === 0 || isSeparatorRow(headers)) return undefined;

	const separator = splitTableRow(lines[1]);
	if (!separator || !isSeparatorRow(separator)) return undefined;

	const rows: string[][] = [];
	for (const line of lines.slice(2)) {
		const cells = splitTableRow(line);
		if (!cells) return undefined;
		if (isSeparatorRow(cells)) continue;
		rows.push(cells);
	}

	return { headers, rows };
}

function normalizeTableLines(text: string): string[] {
	const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	while (lines.length > 0 && lines[0].trim() === "") lines.shift();
	while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
	return lines;
}

function splitTableRow(line: string): string[] | undefined {
	const trimmed = line.trim();
	if (!trimmed.includes("|")) return undefined;
	const parts = trimmed.split("|");
	if (trimmed.startsWith("|")) parts.shift();
	if (trimmed.endsWith("|")) parts.pop();
	return parts.map((cell) => cell.trim());
}

function isSeparatorRow(cells: readonly string[]): boolean {
	return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell));
}
