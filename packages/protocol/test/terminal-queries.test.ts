import { describe, expect, test } from "bun:test";
import { isParserQuery, isSyntheticTerminalReply, stripTerminalParserQueries, takeTerminalParserQueries } from "../src/terminal-queries.js";

describe("terminal parser queries", () => {
  test("treats stacked OSC color and palette queries as parser queries", () => {
    expect(isParserQuery("osc", "?;?", "10")).toBe(true);
    expect(isParserQuery("osc", "0;?", "4")).toBe(true);
    expect(isParserQuery("osc", "0;#fff", "4")).toBe(false);
    expect(isParserQuery("csi", [6], undefined, "n")).toBe(true);
  });

  test("does not classify modified F3 as a synthetic emulator reply", () => {
    expect(isSyntheticTerminalReply("\x1b[1;2R")).toBe(false);
    expect(isSyntheticTerminalReply("\x1b[0c")).toBe(true);
    expect(isSyntheticTerminalReply("\x1b]10;rgb:0000/0000/0000\x07")).toBe(true);
  });

  test("strips queries without removing surrounding text", () => {
    expect(stripTerminalParserQueries("ab\x1b[6ncd\x1b]10;?;?\x07ef\x1b]4;0;?\x07gh")).toBe("abcdefgh");
    expect(stripTerminalParserQueries("\x1b[31mred\x1b[0m")).toBe("\x1b[31mred\x1b[0m");
    expect(stripTerminalParserQueries("ab\x9b6ncd")).toBe("abcd");
  });

  test("holds split and C1 query introducers until the sequence completes", () => {
    const first = takeTerminalParserQueries("ab\x1b[", "");
    expect(first).toEqual({ text: "ab", carry: "\x1b[" });
    expect(takeTerminalParserQueries("6ncd", first.carry)).toEqual({ text: "cd", carry: "" });
    expect(isSyntheticTerminalReply("\x1b[24;80R")).toBe(true);
    expect(isSyntheticTerminalReply("\x9b0c")).toBe(true);
    expect(isSyntheticTerminalReply("\x1b[1;2R")).toBe(false);
  });
});
