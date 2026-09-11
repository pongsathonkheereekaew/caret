import { describe, expect, it } from "vitest";
import { canAttachToPrompt, canRunTool, decideAttach } from "./context-policy.ts";

describe("ContextPolicy", () => {
  it("keeps ignore and sandbox independent", () => {
    expect(decideAttach({ ignored: true, sandboxDenied: false })).toBe("ignored");
    expect(decideAttach({ ignored: false, sandboxDenied: true })).toBe("denied");
    expect(canAttachToPrompt({ ignored: true, sandboxDenied: false })).toBe(false);
    expect(canRunTool(false)).toBe(true);
    expect(canRunTool(true)).toBe(false);
    // Ignore never authorizes a tool that sandbox denied.
    expect(canRunTool(true)).toBe(false);
    expect(canAttachToPrompt({ ignored: false, sandboxDenied: false })).toBe(true);
  });
});
