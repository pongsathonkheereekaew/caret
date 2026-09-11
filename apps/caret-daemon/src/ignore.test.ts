import { describe, expect, it } from "vitest";
import { isIgnored, parseIgnore } from "./ignore.ts";

describe("Ignore", () => {
  it("matches gitignore-shaped lines and honours negation", () => {
    const patterns = parseIgnore("# comment\nnode_modules/\n*.log\n!keep.log\n");
    expect(isIgnored("node_modules/x.ts", patterns)).toBe(true);
    expect(isIgnored("src/app.ts", patterns)).toBe(false);
    expect(isIgnored("debug.log", patterns)).toBe(true);
    expect(isIgnored("keep.log", patterns)).toBe(false);
  });
});
