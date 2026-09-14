import { describe, expect, test } from "bun:test";
import {
  TOOL_CARD_BODY_CAP_PX,
  toolCardBody,
  toolCardCopyText,
  toolCardDefaultExpanded,
} from "../core/tool-card.ts";

describe("tool card defaults", () => {
  test("collapses completed success and expands running or failed", () => {
    expect(toolCardDefaultExpanded("completed")).toBe(false);
    expect(toolCardDefaultExpanded("success")).toBe(false);
    expect(toolCardDefaultExpanded("running")).toBe(true);
    expect(toolCardDefaultExpanded("failed")).toBe(true);
    expect(toolCardDefaultExpanded("cancelled")).toBe(true);
    expect(toolCardDefaultExpanded("unknown")).toBe(true);
    expect(toolCardDefaultExpanded(undefined)).toBe(true);
  });
});

describe("tool card body", () => {
  test("caps collapsed comfortable and detailed previews", () => {
    expect(TOOL_CARD_BODY_CAP_PX).toBe(240);
    const lines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");
    const comfortable = toolCardBody({ text: lines, expanded: false, density: "comfortable" });
    expect(comfortable.numberOfLines).toBe(4);
    expect(comfortable.truncated).toBe(true);
    expect(comfortable.visible.split("\n")).toHaveLength(4);
    const detailed = toolCardBody({ text: lines, expanded: false, density: "detailed" });
    expect(detailed.numberOfLines).toBe(16);
    expect(detailed.truncated).toBe(true);
    expect(detailed.visible.split("\n")).toHaveLength(16);
  });

  test("expanded body keeps the full text without a line clamp", () => {
    const text = "a\n".repeat(30);
    const body = toolCardBody({ text, expanded: true, density: "comfortable" });
    expect(body.visible).toBe(text);
    expect(body.truncated).toBe(false);
    expect(body.numberOfLines).toBeUndefined();
  });
});

describe("tool card copy", () => {
  test("stringifies object args and never executes them", () => {
    const text = toolCardCopyText({
      toolName: "read_file",
      args: { path: "card.ts" },
      output: "ok",
      text: "done",
    });
    expect(text).toBe("read_file\n{\"path\":\"card.ts\"}\nok\ndone");
    expect(toolCardCopyText({ args: "plain" })).toBe("plain");
  });
});
