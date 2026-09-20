/**
 * Engine-agnostic terminal conformance corpus.
 *
 * Why this exists: the terminal Cedia ships is xterm.js from the pinned Code-OSS
 * base, and nothing in this repository has ever asserted what that engine does with
 * the sequences Cedia's own surfaces depend on (VS Code's shell integration, OSC 8
 * links, synchronized output, Thai combining marks, wide characters). The corpus
 * below is the list of behaviours the product needs, expressed only as "these bytes
 * in, this screen out", so the same cases can run against xterm.js today and against
 * any future engine - the Ghostty VT core evaluated in
 * `docs/maintenance/evidence/terminal-vt-spike-2026-09-16/` included - without the
 * expectations changing.
 *
 * Cases marked `required: true` are the ones Cedia must keep; the rest are recorded
 * observations (width choices differ between engines and are not a bug to fix here).
 */

export interface TerminalScreen {
	/** Non-empty rows, right-trimmed, in screen order. */
	readonly rows: readonly string[];
	readonly cursorX: number;
	readonly cursorY: number;
}

export interface TerminalSurface {
	write(data: string): Promise<void>;
	screen(): Promise<TerminalScreen>;
	dispose(): void;
}

export interface TerminalEngine {
	readonly name: string;
	open(cols: number, rows: number): Promise<TerminalSurface>;
}

export interface TerminalConformanceCase {
	readonly id: string;
	readonly name: string;
	readonly input: string;
	/** `false` records engine-dependent behaviour instead of asserting it. */
	readonly required: boolean;
	readonly expectRows: readonly string[];
	readonly expectCursorX?: number;
	readonly note?: string;
}

export interface TerminalConformanceResult {
	readonly id: string;
	readonly name: string;
	readonly required: boolean;
	readonly pass: boolean;
	readonly detail: string;
}

const COLS = 40;
const ROWS = 6;

export const TERMINAL_CONFORMANCE_CASES: readonly TerminalConformanceCase[] = [
	{
		id: "osc633-shell-integration",
		name: "VS Code shell integration marks stay invisible",
		input: "\x1b]633;A\x07\x1b]633;B\x07$ \x1b]633;C\x07ls -la\n",
		required: true,
		expectRows: ["$ ls -la"],
		note: "the workbench's own prompt/command detection rides on these; drawing them would corrupt every prompt",
	},
	{
		id: "osc133-prompt-marks",
		name: "OSC 133 prompt marks and title stay invisible",
		// CRLF is what a PTY actually delivers; a bare LF only moves down and keeps the
		// column, which is correct VT behaviour and not what a prompt looks like.
		input: "\x1b]0;cedia title\x07\x1b]133;A\x07prompt\x1b]133;B\x07cmd\r\n",
		required: true,
		expectRows: ["promptcmd"],
		expectCursorX: 0,
	},
	{
		id: "osc8-hyperlink",
		name: "OSC 8 hyperlink contributes its text only",
		input: "\x1b]8;;https://ghostty.org\x07link\x1b]8;;\x07 text\n",
		required: true,
		expectRows: ["link text"],
	},
	{
		id: "synchronized-output",
		name: "CSI ?2026 synchronized output does not corrupt the screen",
		input: "\x1b[?2026hpartial\x1b[?2026l done\n",
		required: true,
		expectRows: ["partial done"],
	},
	{
		id: "thai-combining-marks",
		name: "Thai combining marks survive the parser",
		input: "ไทย: ก้าน เก่ง น้ำ ไม้\n",
		required: true,
		expectRows: ["ไทย: ก้าน เก่ง น้ำ ไม้"],
		note: "Cedia's users type Thai; a dropped combining mark is a visible defect",
	},
	{
		id: "cjk-width",
		name: "wide characters advance two cells",
		input: "漢字",
		required: true,
		expectRows: ["漢字"],
		expectCursorX: 4,
	},
	{
		id: "cjk-and-box-drawing",
		name: "box drawing mixed with wide characters keeps the row",
		input: "│ 漢字テスト │\n",
		required: true,
		expectRows: ["│ 漢字テスト │"],
	},
	{
		id: "cursor-save-restore",
		name: "DECSC/DECRC restore the saved column",
		input: "AB\x1b7CD\x1b8E\n",
		required: true,
		expectRows: ["ABED"],
	},
	{
		id: "scroll-region-reverse-index",
		name: "scroll region + reverse index move a line without eating the screen",
		input: "\x1b[1;3r\x1b[3;1HX\x1bMY\n",
		required: true,
		// The reverse index moves the region's line down a row, so "Y" keeps its column.
		expectRows: [" Y", "X"],
	},
	{
		id: "erase-line-then-write",
		name: "erase-line and carriage return replace the row",
		input: "\x1b[31mRED\x1b[0m\x1b[2K\rCLEAN\n",
		required: true,
		expectRows: ["CLEAN"],
	},
	{
		id: "alt-screen-round-trip",
		name: "leaving the alternate screen restores the main screen",
		input: "\x1b[?1049hALT\x1b[?1049lMAIN\n",
		required: true,
		expectRows: ["MAIN"],
	},
	{
		id: "emoji-zwj-width",
		name: "ZWJ emoji width",
		input: "👩‍💻 family 👨‍👩‍👧\n",
		required: false,
		expectRows: ["👩‍💻 family 👨‍👩‍👧"],
		note: "recorded, not asserted: engines disagree on ZWJ sequence width, and the screen text is what Cedia renders",
	},
];

/** Runs every case against one engine. Never throws for a failing case. */
export async function runTerminalConformance(engine: TerminalEngine): Promise<readonly TerminalConformanceResult[]> {
	const results: TerminalConformanceResult[] = [];
	for (const testCase of TERMINAL_CONFORMANCE_CASES) {
		const surface = await engine.open(COLS, ROWS);
		try {
			await surface.write(testCase.input);
			const screen = await surface.screen();
			results.push(checkCase(testCase, screen));
		} catch (error) {
			results.push({ id: testCase.id, name: testCase.name, required: testCase.required, pass: false, detail: `engine threw: ${error instanceof Error ? error.message : String(error)}` });
		} finally {
			surface.dispose();
		}
	}
	return results;
}

function checkCase(testCase: TerminalConformanceCase, screen: TerminalScreen): TerminalConformanceResult {
	const rows = screen.rows;
	const rowsMatch = rows.length === testCase.expectRows.length && rows.every((row, index) => row === testCase.expectRows[index]);
	const cursorMatches = testCase.expectCursorX === undefined || screen.cursorX === testCase.expectCursorX;
	if (rowsMatch && cursorMatches) {
		return { id: testCase.id, name: testCase.name, required: testCase.required, pass: true, detail: "as expected" };
	}
	const expected = JSON.stringify(testCase.expectRows);
	const actual = JSON.stringify(rows);
	const cursor = testCase.expectCursorX === undefined ? "" : `, cursorX ${screen.cursorX} (expected ${testCase.expectCursorX})`;
	return { id: testCase.id, name: testCase.name, required: testCase.required, pass: false, detail: `rows ${actual} (expected ${expected})${cursor}` };
}
