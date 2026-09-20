/*
 * Live check: real @coder/libghostty-vt-node addon -> host registry checkpoint runs
 * -> iOS terminalCheckpointSeed -> real @xterm/headless render.
 *
 * Run from the repository root: bun docs/maintenance/evidence/terminal-checkpoint-styles-2026-09-18/live-check.ts
 */
import { Terminal } from "@xterm/headless";

const root = new URL("../../../../", import.meta.url).href;
const { TerminalStateRegistry } = await import(`${root}apps/host/src/terminal-state.ts`);
const { terminalCheckpointSeed } = await import(`${root}apps/ios/src/core/virtual-terminal.ts`);

const registry = new TerminalStateRegistry();
registry.apply({ type: "caret_terminal_open", terminalId: "tty-1", cols: 40, rows: 6, title: "style-smoke" });

const started = Date.now();
while (!registry.active && Date.now() - started < 5000) await new Promise(resolve => setTimeout(resolve, 25));
if (!registry.active) {
	console.error("FAIL: native terminal engine never became active");
	process.exit(1);
}

registry.apply({
	type: "caret_terminal_output",
	terminalId: "tty-1",
	sequence: 1,
	data: "\u001b[31mERR\u001b[0m ok \u001b[1;44mNOTE\u001b[0m",
});

const [checkpoint] = registry.snapshots();
if (!checkpoint) {
	console.error("FAIL: no checkpoint");
	process.exit(1);
}
console.log("checkpoint.runs =", JSON.stringify(checkpoint.runs));
console.log("checkpoint.lines =", JSON.stringify(checkpoint.lines));

const seed = terminalCheckpointSeed(checkpoint);
console.log("seed =", JSON.stringify(seed));

const term = new Terminal({ cols: 40, rows: 6, allowProposedApi: true });
await new Promise<void>(resolve => term.write(seed, () => resolve()));

const buffer = term.buffer.active;
const cells: string[] = [];
for (let x = 0; x < 12; x += 1) {
	const cell = buffer.getLine(0)?.getCell(x);
	if (!cell) continue;
	cells.push(`${JSON.stringify(cell.getChars())} fg=${cell.isFgRGB() ? cell.getFgColor().toString(16) : `palette:${cell.getFgColor()}`} bg=${cell.isBgRGB() ? cell.getBgColor().toString(16) : `palette:${cell.getBgColor()}`}${cell.isBold() ? " bold" : ""}`);
}
console.log("xterm row0 =", JSON.stringify(cells, null, 2));

// What xterm paints must equal what the checkpoint reported (the engine maps
// ANSI red/blue through the terminal palette, so compare the reported hex).
const colour = (hex: string | undefined): number | undefined => (hex ? Number.parseInt(hex.slice(1), 16) : undefined);
const errRun = checkpoint.runs?.find(run => run.text === "ERR");
const noteRun = checkpoint.runs?.find(run => run.text === "NOTE");
const err = buffer.getLine(0)?.getCell(0);
const okCell = buffer.getLine(0)?.getCell(4);
const note = buffer.getLine(0)?.getCell(7);
const failures: string[] = [];
if (!errRun?.foreground || !err || !err.isFgRGB() || err.getFgColor() !== colour(errRun.foreground)) failures.push("ERR foreground does not match the checkpoint run");
if (!noteRun?.background || !note || !note.isBgRGB() || note.getBgColor() !== colour(noteRun.background) || !note.isBold()) failures.push("NOTE background/bold does not match the checkpoint run");
if (!okCell || okCell.isFgRGB() || okCell.isBgRGB()) failures.push("' ok ' inherited a neighbouring run's style");
if (!checkpoint.runs?.length) failures.push("checkpoint carried no runs");

term.dispose();
registry.dispose();

if (failures.length > 0) {
	console.error("FAIL:", failures.join("; "));
	process.exit(1);
}
console.log("LIVE-OK: native engine styles -> checkpoint runs -> xterm truecolour cells");
