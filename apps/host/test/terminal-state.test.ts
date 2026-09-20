import { afterEach, describe, expect, it } from "bun:test";
import { TerminalStateRegistry, type TerminalEngine, type TerminalEngineTerminal } from "../src/terminal-state.ts";

/** A deterministic stand-in so the registry's own rules are tested without engine internals. */
function fakeEngine(): TerminalEngine {
  const screens = new WeakMap<TerminalEngineTerminal, { text: string; cols: number; rows: number }>();
  return {
    createTerminal({ cols, rows }) {
      const state = { text: "", cols, rows };
      const terminal: TerminalEngineTerminal = {
        feed: (data: string) => { state.text += data; },
        resize: (nextCols: number, nextRows: number) => { state.cols = nextCols; state.rows = nextRows; },
        snapshot: () => ({
          cols: state.cols,
          rows: state.rows,
          cursorRow: 0,
          cursorCol: state.text.length,
          visibleLines: state.text.split("\n").map(text => ({ text })),
        }),
        dispose: () => { state.text = ""; },
      };
      screens.set(terminal, state);
      return terminal;
    },
    getNativeInfo: () => ({ platform: process.platform, arch: process.arch, packageVersion: "fake" }),
  };
}

function registryWithFakeEngine(): TerminalStateRegistry {
  return new TerminalStateRegistry(async () => fakeEngine());
}

interface StyledCellFixture {
  row: number;
  col: number;
  text: string;
  width: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  foreground?: string;
  background?: string;
}

/** A fake engine whose snapshot carries fixed styled cells, so run merging is pinned exactly. */
function fakeStyledEngine(snapshot: { rows?: number; cols?: number; lines?: readonly string[]; cells?: readonly StyledCellFixture[] }): TerminalEngine {
  const rows = snapshot.rows ?? 4;
  const cols = snapshot.cols ?? 40;
  return {
    createTerminal() {
      return {
        feed: () => {},
        resize: () => {},
        snapshot: () => ({
          cols,
          rows,
          cursorRow: 0,
          cursorCol: 0,
          visibleLines: (snapshot.lines ?? []).map(text => ({ text })),
          ...(snapshot.cells === undefined ? {} : { cells: snapshot.cells }),
        }),
        dispose: () => {},
      };
    },
    getNativeInfo: () => ({ platform: process.platform, arch: process.arch, packageVersion: "fake-styled" }),
  };
}

async function checkpointFrom(engine: TerminalEngine) {
  const registry = new TerminalStateRegistry(async () => engine);
  registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 4 });
  await settle(registry, 1);
  return registry.snapshots()[0]!;
}

/** The engine loads asynchronously; frames sent before it arrives are replayed after. */
async function settle(registry: TerminalStateRegistry, expectedTerminals: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (registry.terminalCount < expectedTerminals) {
    if (Date.now() >= deadline) throw new Error(`engine never caught up (${registry.terminalCount} terminals)`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

describe("TerminalStateRegistry", () => {
  it("keeps one screen per terminal from open, output and close frames", async () => {
    const registry = registryWithFakeEngine();
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 4, title: "zsh" });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 0, data: "hello\n" });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 1, data: "world\n" });
    await settle(registry, 1);

    const [checkpoint] = registry.snapshots();
    expect(checkpoint.terminalId).toBe("t1");
    expect(checkpoint.title).toBe("zsh");
    expect(checkpoint.lines).toEqual(["hello", "world"]);
    expect(checkpoint.lastSequence).toBe(1);
    expect(checkpoint.closed).toBe(false);
    expect(checkpoint.historyIncomplete).toBe(false);

    registry.apply({ type: "cedia_terminal_close", terminalId: "t1", reason: "exited" });
    const [closed] = registry.snapshots();
    expect(closed.closed).toBe(true);
    expect(closed.closeReason).toBe("exited");
    // The final screen stays readable after close - that is the point of a checkpoint.
    expect(closed.lines).toEqual(["hello", "world"]);
  });

  it("ignores duplicate sequences and marks a real gap as incomplete", async () => {
    const registry = registryWithFakeEngine();
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 4 });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 0, data: "one\n" });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 0, data: "duplicate\n" });
    await settle(registry, 1);
    expect(registry.snapshots()[0].lines).toEqual(["one"]);

    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 4, data: "after-gap\n" });
    const [checkpoint] = registry.snapshots();
    expect(checkpoint.lines).toEqual(["one", "after-gap"]);
    expect(checkpoint.historyIncomplete).toBe(true);
    expect(checkpoint.lastSequence).toBe(4);
  });

  it("reopens a terminal for a reattaching client without losing the screen", async () => {
    const registry = registryWithFakeEngine();
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 4 });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 0, data: "kept\n" });
    registry.apply({ type: "cedia_terminal_close", terminalId: "t1", reason: "detached" });
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 80, rows: 10 });
    await settle(registry, 1);

    const [checkpoint] = registry.snapshots();
    expect(checkpoint.lines).toEqual(["kept"]);
    expect(checkpoint.closed).toBe(false);
    expect(checkpoint.closeReason).toBeUndefined();
    expect(checkpoint.cols).toBe(80);
    expect(checkpoint.rows).toBe(10);
  });

  it("follows a resize once OMP acknowledged it", async () => {
    const registry = registryWithFakeEngine();
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 4 });
    await settle(registry, 1);
    registry.resize("t1", 120, 30);
    const [checkpoint] = registry.snapshots();
    expect(checkpoint.cols).toBe(120);
    expect(checkpoint.rows).toBe(30);
    // A closed terminal is history: a late resize must not resurrect it.
    registry.apply({ type: "cedia_terminal_close", terminalId: "t1", reason: "exited" });
    registry.resize("t1", 20, 5);
    expect(registry.snapshots()[0].cols).toBe(120);
  });

  it("keeps running without an engine and reports no checkpoints", async () => {
    const registry = new TerminalStateRegistry(async () => undefined);
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 4 });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 0, data: "unused\n" });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(registry.active).toBe(false);
    expect(registry.snapshots()).toEqual([]);
    // Ignoring the frames is not an error: the session keeps working.
    expect(() => registry.dispose()).not.toThrow();
  });

  it("merges adjacent cells that share a style into one coloured run", async () => {
    const checkpoint = await checkpointFrom(fakeStyledEngine({
      lines: ["hi"],
      cells: [
        { row: 0, col: 0, text: "h", width: 1, foreground: "#ff0000", background: "#000000" },
        { row: 0, col: 1, text: "i", width: 1, foreground: "#ff0000", background: "#000000" },
      ],
    }));
    expect(checkpoint.runs).toEqual([
      { row: 0, col: 0, text: "hi", foreground: "#ff0000", background: "#000000" },
    ]);
  });

  it("starts a new run at a style change and at a column gap", async () => {
    const checkpoint = await checkpointFrom(fakeStyledEngine({
      lines: ["abc e"],
      cells: [
        { row: 0, col: 0, text: "a", width: 1, bold: true },
        { row: 0, col: 1, text: "b", width: 1, bold: true },
        { row: 0, col: 2, text: "c", width: 1 },
        { row: 0, col: 4, text: "e", width: 1 },
      ],
    }));
    expect(checkpoint.runs).toEqual([
      { row: 0, col: 0, text: "ab", bold: true },
      { row: 0, col: 2, text: "c" },
      { row: 0, col: 4, text: "e" },
    ]);
  });

  it("reports no runs when the engine has no cells", async () => {
    const checkpoint = await checkpointFrom(fakeEngine());
    expect("runs" in checkpoint).toBe(false);
  });

  it("ignores cells outside the grid and cells with empty text", async () => {
    const checkpoint = await checkpointFrom(fakeStyledEngine({
      rows: 3,
      lines: ["ok"],
      cells: [
        { row: 0, col: 0, text: "", width: 1, bold: true },
        { row: 3, col: 0, text: "outside", width: 1, bold: true },
        { row: -1, col: 0, text: "negative", width: 1, bold: true },
        { row: 0, col: 1, text: "ok", width: 1, bold: true },
      ],
    }));
    expect(checkpoint.runs).toEqual([{ row: 0, col: 1, text: "ok", bold: true }]);
  });
});

describe("libghostty-vt (the host's terminal engine)", () => {
  const registries: TerminalStateRegistry[] = [];

  afterEach(() => {
    for (const registry of registries.splice(0)) registry.dispose();
  });

  it("loads a prebuild for this platform and renders a real screen", async () => {
    // This fails when the platform has no prebuild or the package is missing, which is
    // the gate the plan asks for: shipping the host means shipping this addon.
    const registry = new TerminalStateRegistry();
    registries.push(registry);
    registry.apply({ type: "cedia_terminal_open", terminalId: "t1", cols: 40, rows: 6 });
    registry.apply({ type: "cedia_terminal_output", terminalId: "t1", sequence: 0, data: "line one\r\n\x1b[31mred\x1b[0m ไทย\r\n" });
    await settle(registry, 1);

    const [checkpoint] = registry.snapshots();
    expect(checkpoint.lines).toEqual(["line one", "red ไทย"]);
    expect(checkpoint.cols).toBe(40);
    expect(checkpoint.rows).toBe(6);
    expect(checkpoint.historyIncomplete).toBe(false);
  });
});
