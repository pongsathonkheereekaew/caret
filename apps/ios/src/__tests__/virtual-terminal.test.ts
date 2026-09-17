import { describe, expect, test } from "bun:test";
import type { TerminalCheckpoint } from "../../../../packages/protocol/src/index.ts";
import {
  CARET_TERMINAL_MAX_HISTORY_BYTES,
  applyVirtualTerminalFrame,
  terminalCheckpointSeed,
  terminalNegotiateCommand,
  terminalInputCommand,
  terminalResizeCommand,
  VirtualTerminalRendererCoordinator,
  type VirtualTerminalIdentity,
  type VirtualTerminalSnapshot,
} from "../core/index.ts";
import { isParserQuery, terminalDocument, terminalMessage } from "../components/terminal/document.ts";

function frame(type: string, fields: Record<string, unknown>): Record<string, unknown> {
  return { type, ...fields };
}

const identity: VirtualTerminalIdentity = { sessionId: "session-1", incarnation: "inc-1", terminalId: "tty-1" };

function snapshot(overrides: Partial<VirtualTerminalSnapshot> = {}): VirtualTerminalSnapshot {
  return {
    terminalId: identity.terminalId,
    cols: 80,
    rows: 24,
    closed: false,
    outputs: [],
    lastOutputSequence: -1,
    historyBytes: 0,
    historyTruncated: false,
    ...overrides,
  };
}

describe("OMP virtual terminal projection", () => {
  test("keeps ANSI output ordered and idempotent across duplicate replay", () => {
    let terminals = applyVirtualTerminalFrame([], frame("caret_terminal_open", { terminalId: "tty-1", title: "Shell", cols: 80, rows: 24 }));
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence: 0, data: "\u001b[31mred\u001b[0m" }));
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence: 1, data: "\nnext" }));
    const duplicate = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence: 1, data: "MUTATION" }));
    expect(duplicate).toEqual(terminals);
    expect(terminals[0]?.outputs.map(item => item.data)).toEqual(["\u001b[31mred\u001b[0m", "\nnext"]);
    expect(terminals[0]?.lastOutputSequence).toBe(1);
  });

  test("rejects output before open and after close, then preserves history on reopen", () => {
    let terminals = applyVirtualTerminalFrame([], frame("caret_terminal_output", { terminalId: "tty-1", sequence: 0, data: "late" }));
    expect(terminals).toHaveLength(0);
    terminals = applyVirtualTerminalFrame([], frame("caret_terminal_open", { terminalId: "tty-1", cols: 100, rows: 30 }));
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence: 0, data: "old" }));
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_close", { terminalId: "tty-1", reason: "stopped" }));
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence: 1, data: "must-not-resurrect" }));
    expect(terminals[0]?.outputs.map(item => item.data)).toEqual(["old"]);
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_open", { terminalId: "tty-1", cols: 90, rows: 20 }));
    terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence: 1, data: "new" }));
    expect(terminals[0]).toMatchObject({ closed: false, cols: 90, rows: 20, lastOutputSequence: 1 });
    expect(terminals[0]?.outputs.map(item => item.data)).toEqual(["old", "new"]);
  });

  test("bounds history while retaining the newest sequence", () => {
    let terminals = applyVirtualTerminalFrame([], frame("caret_terminal_open", { terminalId: "tty-1", cols: 80, rows: 24 }));
    const chunk = "x".repeat(64 * 1024);
    for (let sequence = 0; sequence < 80; sequence += 1) {
      terminals = applyVirtualTerminalFrame(terminals, frame("caret_terminal_output", { terminalId: "tty-1", sequence, data: chunk }));
    }
    expect(terminals[0]?.historyBytes).toBeLessThanOrEqual(CARET_TERMINAL_MAX_HISTORY_BYTES);
    expect(terminals[0]?.lastOutputSequence).toBe(79);
    expect(terminals[0]?.outputs.at(-1)?.sequence).toBe(79);
    expect(terminals[0]?.historyTruncated).toBe(true);
  });

  test("validates durable input and resize payloads without retry metadata", () => {
    expect(terminalInputCommand("tty-1", "\r")).toEqual({ command: "caret_terminal_input", payload: { terminalId: "tty-1", data: "\r" } });
    expect(terminalResizeCommand("tty-1", 120, 32)).toEqual({ command: "caret_terminal_resize", payload: { terminalId: "tty-1", cols: 120, rows: 32 } });
    expect(() => terminalInputCommand("tty-1", "x".repeat(64 * 1024 + 1))).toThrow();
    expect(() => terminalResizeCommand("tty-1", 1, 32)).toThrow();
    expect(terminalNegotiateCommand(120, 32)).toEqual({ command: "caret_terminal_negotiate", payload: { version: 1, cols: 120, rows: 32 } });
    expect(() => terminalNegotiateCommand(1, 32)).toThrow();
  });
});

describe("terminal renderer recovery coordinator", () => {
  test("replays once per ready generation and keeps mounted output incremental after trimming", () => {
    const coordinator = new VirtualTerminalRendererCoordinator(identity);
    const first = coordinator.ready(identity, snapshot({ outputs: [{ sequence: 0, data: "old" }], lastOutputSequence: 0 }));
    expect(first?.messages.map(message => message.type)).toEqual(["replay_start", "output", "replay_end"]);
    const live = coordinator.update(identity, snapshot({ outputs: [{ sequence: 0, data: "old" }, { sequence: 1, data: "new" }], lastOutputSequence: 1, historyTruncated: true }));
    expect(live?.messages).toEqual([{ type: "output", sequence: 1, data: "new" }]);
    const second = coordinator.ready(identity, snapshot({ outputs: [{ sequence: 1, data: "new" }], lastOutputSequence: 1, historyTruncated: true }));
    expect(second?.readyGeneration).toBe(2);
    expect(second?.messages.map(message => message.type)).toEqual(["replay_start", "replay_end"]);
    expect(second?.requestRecovery).toBe(true);
  });

  test("requests one redraw for a truncated ready or a missing sequence, then streams new output", () => {
    const coordinator = new VirtualTerminalRendererCoordinator(identity);
    const recovery = coordinator.ready(identity, snapshot({ outputs: [{ sequence: 8, data: "tail" }], lastOutputSequence: 8, historyTruncated: true }));
    expect(recovery?.requestRecovery).toBe(true);
    expect(coordinator.update(identity, snapshot({ outputs: [{ sequence: 8, data: "tail" }], lastOutputSequence: 8, historyTruncated: true }))?.requestRecovery).toBe(false);
    const afterRedraw = coordinator.update(identity, snapshot({ outputs: [{ sequence: 9, data: "live" }], lastOutputSequence: 9, historyTruncated: true }));
    expect(afterRedraw?.messages).toEqual([{ type: "output", sequence: 9, data: "live" }]);

    const gapCoordinator = new VirtualTerminalRendererCoordinator(identity);
    gapCoordinator.ready(identity, snapshot({ outputs: [{ sequence: 0, data: "a" }], lastOutputSequence: 0 }));
    const gap = gapCoordinator.update(identity, snapshot({ outputs: [{ sequence: 2, data: "c" }], lastOutputSequence: 2, historyTruncated: true }));
    expect(gap?.requestRecovery).toBe(true);
    expect(gapCoordinator.update(identity, snapshot({ outputs: [{ sequence: 2, data: "c" }], lastOutputSequence: 2, historyTruncated: true }))?.requestRecovery).toBe(false);
  });

  test("rejects stale renderer identity and does not recover a closed terminal", () => {
    const coordinator = new VirtualTerminalRendererCoordinator(identity);
    const stale = { ...identity, incarnation: "new-incarnation" };
    expect(coordinator.ready(stale, snapshot({ historyTruncated: true }))).toBeNull();
    expect(coordinator.ready(identity, snapshot({ historyTruncated: true, closed: true }))).toMatchObject({ requestRecovery: false });
    expect(coordinator.update(stale, snapshot({ historyTruncated: true, lastOutputSequence: 2 }))).toBeNull();
  });
});

const checkpoint: TerminalCheckpoint = {
  terminalId: "tty-1",
  cols: 20,
  rows: 4,
  cursorRow: 2,
  cursorCol: 5,
  lines: ["$ npm test", "caret-virtual-output"],
  lastSequence: 41,
  closed: false,
  historyIncomplete: false,
};

describe("host terminal checkpoint", () => {
  test("paints the host grid and puts the cursor back", () => {
    expect(terminalCheckpointSeed(checkpoint)).toBe(
      "\u001b[?25l\u001b[2J\u001b[H"
      + "\u001b[1;1H$ npm test\u001b[K"
      + "\u001b[2;1Hcaret-virtual-output\u001b[K"
      + "\u001b[3;6H\u001b[?25h",
    );
  });

  test("clamps a cursor that sits outside the checkpoint grid", () => {
    expect(terminalCheckpointSeed({ ...checkpoint, cursorRow: 99, cursorCol: 99 }).endsWith("\u001b[4;20H\u001b[?25h")).toBe(true);
  });

  test("seeds the renderer from the checkpoint instead of asking OMP to redraw", () => {
    const coordinator = new VirtualTerminalRendererCoordinator(identity);
    const truncated = snapshot({ outputs: [{ sequence: 41, data: "tail" }], lastOutputSequence: 41, historyTruncated: true });
    const plan = coordinator.ready(identity, truncated, checkpoint);
    expect(plan?.requestRecovery).toBe(false);
    expect(plan?.messages[0]).toMatchObject({ type: "replay_start", cols: 20, rows: 4, historyTruncated: true, checkpoint: true });
    expect(plan?.messages[1]).toEqual({ type: "output", sequence: 41, data: terminalCheckpointSeed(checkpoint) });
    expect(plan?.messages.at(-1)).toEqual({ type: "replay_end" });
    expect(coordinator.sentSequence).toBe(41);
    // Live output continues from the sequence the checkpoint carried: no gap, no redraw.
    const live = coordinator.update(identity, snapshot({ outputs: [{ sequence: 42, data: "live" }], lastOutputSequence: 42, historyTruncated: true }));
    expect(live).toMatchObject({ requestRecovery: false, messages: [{ type: "output", sequence: 42, data: "live" }] });
  });

  test("falls back to the OMP redraw when the checkpoint is missing, stale or empty", () => {
    const truncated = snapshot({ outputs: [{ sequence: 41, data: "tail" }], lastOutputSequence: 41, historyTruncated: true });
    expect(new VirtualTerminalRendererCoordinator(identity).ready(identity, truncated)?.requestRecovery).toBe(true);
    expect(new VirtualTerminalRendererCoordinator(identity).ready(identity, truncated, { ...checkpoint, terminalId: "other" })?.requestRecovery).toBe(true);
    expect(new VirtualTerminalRendererCoordinator(identity).ready(identity, truncated, { ...checkpoint, lastSequence: -1 })?.requestRecovery).toBe(true);
    // Nothing was trimmed: an intact replay never seeds and never recovers.
    const intact = new VirtualTerminalRendererCoordinator(identity).ready(identity, snapshot({ outputs: [{ sequence: 0, data: "old" }], lastOutputSequence: 0 }), checkpoint);
    expect(intact?.requestRecovery).toBe(false);
    expect(intact?.messages).toHaveLength(3);
  });
});

describe("bundled terminal document bridge", () => {
  /** Boots the generated document with a fake xterm and returns what it wrote. */
  async function bootDocument(): Promise<{ writes: string[]; send: (payload: Record<string, unknown>) => void }> {
    const html = terminalDocument({ terminalId: "tty-1", cols: 80, rows: 24, title: "Shell" });
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
    const writes: string[] = [];
    const listeners: Array<(event: { data: string }) => void> = [];
    class FakeTerminal {
      open(): void {}
      reset(): void { writes.push("\u0000reset"); }
      resize(): void {}
      focus(): void {}
      onData(): void {}
      write(data: string, callback?: () => void): void { writes.push(data); queueMicrotask(() => callback?.()); }
    }
    class FakeParser {
      registerCsiHandler(): { dispose(): void } { return { dispose() {} }; }
      registerDcsHandler(): { dispose(): void } { return { dispose() {} }; }
      registerOscHandler(): { dispose(): void } { return { dispose() {} }; }
    }
    const previousTerminal = (globalThis as unknown as { Terminal?: unknown }).Terminal;
    (globalThis as unknown as { Terminal: unknown }).Terminal = class extends FakeTerminal {
      readonly parser = new FakeParser();
    };
    try {
      const windowObject = { parent: { postMessage: () => undefined }, ReactNativeWebView: undefined, addEventListener: (_type: string, callback: (event: { data: string }) => void) => listeners.push(callback) };
      new Function("window", "document", script!)(windowObject, { getElementById: () => ({}) });
    } finally {
      if (previousTerminal === undefined) delete (globalThis as unknown as { Terminal?: unknown }).Terminal;
      else (globalThis as unknown as { Terminal: unknown }).Terminal = previousTerminal;
    }
    const send = (payload: Record<string, unknown>) => {
      const event = { data: JSON.stringify({ source: "caret-terminal", payload }) };
      for (const listener of listeners) listener(event);
    };
    await new Promise(resolve => setTimeout(resolve, 5));
    return { writes, send };
  }

  test("renders a checkpoint seed without printing the expired notice", async () => {
    const seeded = await bootDocument();
    seeded.send({ type: "replay_start", terminalId: "tty-1", cols: 20, rows: 4, historyTruncated: true, checkpoint: true });
    seeded.send({ type: "output", terminalId: "tty-1", sequence: 41, data: "SEED-BYTES" });
    seeded.send({ type: "replay_end", terminalId: "tty-1" });
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(seeded.writes.filter(text => text.includes("expired") || text.includes("restoring"))).toEqual([]);
    expect(seeded.writes).toContain("SEED-BYTES");

    // Without a checkpoint the same truncated replay keeps its honest notice.
    const redrawn = await bootDocument();
    redrawn.send({ type: "replay_start", terminalId: "tty-1", cols: 20, rows: 4, historyTruncated: true, recovery: true });
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(redrawn.writes.some(text => text.includes("restoring"))).toBe(true);
  });

  test("contains xterm bundle and only accepts the Caret bridge envelope", () => {
    const html = terminalDocument({ terminalId: "tty-1", cols: 80, rows: 24, title: "Shell" });
    expect(html).toContain("globalThis.Terminal");
    expect(html).toContain("replay_start");
    expect(html).toContain("replay_end");
    expect(html).toContain("history expired");
    expect(html).toContain("if(replaying)return");
    expect(html).toContain("ReactNativeWebView");
    expect(html).toContain("xterm");
    expect(terminalMessage(JSON.stringify({ source: "caret-terminal", payload: { type: "ready", terminalId: "tty-1" } }))).toMatchObject({ type: "ready", terminalId: "tty-1" });
    expect(terminalMessage(JSON.stringify({ type: "ready", terminalId: "tty-1" }))).toMatchObject({ type: "ready", terminalId: "tty-1" });
    expect(terminalMessage(JSON.stringify({ source: "other", payload: { type: "input", data: "rm -rf" } }))).toBeNull();
    expect(terminalMessage("not-json")).toBeNull();
  });

  test("does not turn replayed device-status responses into terminal input", async () => {
    const html = terminalDocument({ terminalId: "tty-1", cols: 80, rows: 24, title: "Shell" });
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
    expect(script).toBeTruthy();
    const previousTerminal = (globalThis as unknown as { Terminal?: unknown }).Terminal;
    const posted: string[] = [];
    const listeners: Array<(event: { data: string }) => void> = [];
    let renderer: FakeTerminal | undefined;
    class FakeTerminal {
      readonly writes: string[] = [];
      readonly parser = new FakeParser();
      #onData: ((data: string) => void) | undefined;
      constructor() { renderer = this; }
      open(): void {}
      reset(): void {}
      resize(): void {}
      focus(): void {}
      onData(callback: (data: string) => void): void { this.#onData = callback; }
      write(data: string, callback?: () => void): void {
        this.writes.push(data);
        // xterm emits a response when replayed ANSI asks for cursor status.
        if (data.includes("\u001b[6n")) this.#onData?.("\u001b[1;1R");
        queueMicrotask(() => callback?.());
      }
      userInput(data: string): void { this.#onData?.(data); }
    }
    class FakeParser {
      readonly csi: Array<{ id: Record<string, string>; callback: (params: unknown[]) => boolean }> = [];
      readonly dcs: Array<{ id: Record<string, string>; callback: (data: string, params: unknown[]) => boolean }> = [];
      readonly osc: Array<{ ident: number; callback: (data: string) => boolean }> = [];
      registerCsiHandler(id: Record<string, string>, callback: (params: unknown[]) => boolean): { dispose(): void } { this.csi.push({ id, callback }); return { dispose() {} }; }
      registerDcsHandler(id: Record<string, string>, callback: (data: string, params: unknown[]) => boolean): { dispose(): void } { this.dcs.push({ id, callback }); return { dispose() {} }; }
      registerOscHandler(ident: number, callback: (data: string) => boolean): { dispose(): void } { this.osc.push({ ident, callback }); return { dispose() {} }; }
    }
    const parent = { postMessage: (value: string) => posted.push(value) };
    const windowObject = {
      parent: undefined as unknown as { postMessage: (value: string) => void },
      ReactNativeWebView: undefined,
      addEventListener: (_type: string, callback: (event: { data: string }) => void) => listeners.push(callback),
    };
    windowObject.parent = parent;
    const documentObject = { getElementById: () => ({}) };
    (globalThis as unknown as { Terminal: unknown }).Terminal = FakeTerminal;
    try {
      // The generated document's final script only needs the small DOM/window
      // surface above; the bundled xterm script is intentionally not loaded.
      new Function("window", "document", script!)(windowObject, documentObject);
      const send = (payload: Record<string, unknown>) => {
        const event = { data: JSON.stringify({ source: "caret-terminal", payload }) };
        for (const listener of listeners) listener(event);
      };
      send({ type: "replay_start", terminalId: "tty-1", cols: 80, rows: 24 });
      send({ type: "output", terminalId: "tty-1", sequence: 0, data: "\u001b[6n" });
      send({ type: "replay_end", terminalId: "tty-1" });
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(posted.map(value => JSON.parse(value).payload.type)).toEqual(["ready"]);
      const parser = renderer?.parser;
      expect(parser?.csi.find(item => item.id.final === "n")?.callback([6])).toBe(true);
      expect(parser?.csi.find(item => item.id.final === "c")?.callback([0])).toBe(true);
      expect(parser?.csi.find(item => item.id.final === "t")?.callback([18])).toBe(true);
      expect(parser?.dcs.find(item => item.id.final === "q")?.callback("m", [])).toBe(true);
      expect(parser?.osc.find(item => item.ident === 10)?.callback("?")).toBe(true);
      expect(parser?.osc.find(item => item.ident === 10)?.callback("?;?")).toBe(true);
      expect(parser?.osc.find(item => item.ident === 10)?.callback("#ffffff")).toBe(false);
      expect(parser?.osc.find(item => item.ident === 4)?.callback("0;?")).toBe(true);
      expect(parser?.osc.find(item => item.ident === 4)?.callback("0;#ffffff")).toBe(false);
      renderer?.userInput("ls\r");
      renderer?.userInput("\u001b[1;2R");
      expect(posted.map(value => JSON.parse(value).payload.type)).toEqual(["ready", "input", "input"]);
      expect(posted.map(value => JSON.parse(value).payload.data).slice(1)).toEqual(["ls\r", "\u001b[1;2R"]);
    } finally {
      if (previousTerminal === undefined) delete (globalThis as unknown as { Terminal?: unknown }).Terminal;
      else (globalThis as unknown as { Terminal: unknown }).Terminal = previousTerminal;
    }
  });

  test("keeps parser guard predicates exact without filtering user key bytes", () => {
    expect(isParserQuery("csi", [6], undefined, "n")).toBe(true);
    expect(isParserQuery("csi", [1, 2], undefined, "n")).toBe(false);
    expect(isParserQuery("csi", [0], undefined, "c")).toBe(true);
    expect(isParserQuery("csi", [1], undefined, "c")).toBe(false);
    expect(isParserQuery("osc", "?")).toBe(true);
    expect(isParserQuery("osc", "?;?", "10")).toBe(true);
    expect(isParserQuery("osc", "#ffffff", "10")).toBe(false);
    expect(isParserQuery("osc", "0;?", "4")).toBe(true);
    expect(isParserQuery("osc", "1;#fff;2;?", "4")).toBe(true);
    expect(isParserQuery("osc", "0;#ffffff", "4")).toBe(false);
    expect(isParserQuery("dcs", "m")).toBe(true);
    expect(terminalDocument({ terminalId: "tty-1", cols: 80, rows: 24 })).toContain("registerOscHandler(4");
  });
});
