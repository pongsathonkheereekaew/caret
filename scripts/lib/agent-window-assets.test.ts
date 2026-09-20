import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentWindowDigest } from "./agent-window-assets.ts";

test("Agent Window receipt changes when a renderer asset or main bridge changes", () => {
  const root = mkdtempSync(join(tmpdir(), "cedia-agent-assets-"));
  try {
    expect(agentWindowDigest(root)).toBeUndefined();
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "index.html"), '<script src="./assets/ui.js"></script>');
    writeFileSync(join(root, "main.cjs"), "main");
    writeFileSync(join(root, "assets/ui.js"), "first");
    const before = agentWindowDigest(root);
    expect(before).toMatch(/^[a-f0-9]{64}$/);
    expect(agentWindowDigest(root)).toBe(before);
    writeFileSync(join(root, "assets/ui.js"), "second");
    expect(agentWindowDigest(root)).not.toBe(before);
    const next = agentWindowDigest(root);
    writeFileSync(join(root, "main.cjs"), "changed");
    expect(agentWindowDigest(root)).not.toBe(next);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
