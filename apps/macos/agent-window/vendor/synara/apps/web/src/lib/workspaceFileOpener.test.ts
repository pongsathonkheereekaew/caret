import { describe, expect, it } from "vitest";

import { resolveIdeFileOpenTarget } from "./workspaceFileOpener";

const ROOT = "/work/proj";

describe("resolveIdeFileOpenTarget", () => {
  it("joins a workspace-relative reference onto the workspace root", () => {
    expect(resolveIdeFileOpenTarget(ROOT, "src/foo.ts")).toBe("/work/proj/src/foo.ts");
  });

  it("strips a line position suffix", () => {
    expect(resolveIdeFileOpenTarget(ROOT, "src/foo.ts:12")).toBe("/work/proj/src/foo.ts");
  });

  it("passes an absolute path through", () => {
    expect(resolveIdeFileOpenTarget(ROOT, "/other/place/bar.ts")).toBe(
      "/other/place/bar.ts",
    );
  });

  it("refuses traversal and empty references", () => {
    expect(resolveIdeFileOpenTarget(ROOT, "../../etc/passwd")).toBeNull();
    expect(resolveIdeFileOpenTarget(ROOT, "   ")).toBeNull();
  });

  it("needs the workspace root for relative references", () => {
    expect(resolveIdeFileOpenTarget(null, "src/foo.ts")).toBeNull();
  });
});
