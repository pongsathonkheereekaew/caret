import { afterEach, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EditorConnections } from "../src/editors.ts";
import { NativeEditorBridge } from "../src/native-editor.ts";
import { applyNativeDisk } from "../src/native-disk.ts";

const cleanups: (() => void)[] = [];

afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "caret-native-disk-")));
  const path = join(root, "buffer.txt");
  const other = join(root, "other.txt");
  writeFileSync(path, "disk original\n", { mode: 0o640 });
  writeFileSync(other, "other\n", { mode: 0o600 });
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  return { root, path, other };
}

function request(root: string, path: string, expectedCanonicalPath: string, expectedText: string, content: string) {
  return { cwd: root, path, expectedCanonicalPath, expectedText, content };
}

it("rejects mismatched expected bytes without changing the file", () => {
  const f = fixture();
  expect(() => applyNativeDisk(request(f.root, f.path, f.path, "wrong", "replacement"))).toThrow(/expected bytes/i);
  expect(readFileSync(f.path, "utf8")).toBe("disk original\n");
});

it("rejects a retargeted lexical symlink before changing either target", () => {
  const f = fixture();
  const alias = join(f.root, "alias.txt");
  symlinkSync(f.path, alias);
  symlinkSync(f.other, join(f.root, "retarget.txt"));
  // The alias is retargeted after the model observed f.path as its canonical target.
  rmSync(alias);
  symlinkSync(f.other, alias);
  expect(() => applyNativeDisk(request(f.root, alias, f.path, "disk original\n", "replacement"))).toThrow(/target|canonical/i);
  expect(readFileSync(f.path, "utf8")).toBe("disk original\n");
  expect(readFileSync(f.other, "utf8")).toBe("other\n");
});

it("rejects directories and symlink canonical paths", () => {
  const f = fixture();
  const directory = join(f.root, "directory");
  const alias = join(f.root, "alias.txt");
  mkdirSync(directory);
  symlinkSync(f.path, alias);
  expect(() => applyNativeDisk(request(f.root, directory, directory, "", "x"))).toThrow(/regular file|open|directory/i);
  expect(() => applyNativeDisk(request(f.root, alias, alias, "disk original\n", "x"))).toThrow(/canonical|symlink/i);
  expect(readFileSync(f.path, "utf8")).toBe("disk original\n");
});

it("denies headless disk applies once a workspace was registered, including expiry", async () => {
  const f = fixture();
  const editors = new EditorConnections();
  const bridge = new NativeEditorBridge(editors, f.root);
  cleanups.push(() => editors.close());
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    editors.register("window", [f.root]);
    await expect(bridge.handle({ kind: "apply_disk", path: f.path, expectedCanonicalPath: f.path, expectedText: "disk original\n", content: "replacement" }, new AbortController().signal)).rejects.toThrow(/registered/i);
    now += 6_000;
    expect(editors.hasConnection(f.root)).toBe(false);
    await expect(bridge.handle({ kind: "apply_disk", path: f.path, expectedCanonicalPath: f.path, expectedText: "disk original\n", content: "replacement" }, new AbortController().signal)).rejects.toThrow(/registered/i);
    expect(readFileSync(f.path, "utf8")).toBe("disk original\n");
  } finally { Date.now = originalNow; }
});

it("routes an unregistered workspace through the native editor disk branch", async () => {
  const f = fixture();
  const editors = new EditorConnections();
  const bridge = new NativeEditorBridge(editors, f.root);
  cleanups.push(() => editors.close());
  await expect(bridge.handle({ kind: "apply_disk", path: f.path, expectedCanonicalPath: f.path, expectedText: "disk original\n", content: "replacement" }, new AbortController().signal)).resolves.toEqual({
    text: "replacement", saved: true, canonicalPath: f.path,
  });
  expect(readFileSync(f.path, "utf8")).toBe("replacement");
});

it("writes through one descriptor while preserving inode and mode", () => {
  const f = fixture();
  const before = statSync(f.path);
  const result = applyNativeDisk(request(f.root, f.path, f.path, "disk original\n", "replacement"));
  const after = statSync(f.path);
  expect(result).toEqual({ text: "replacement", saved: true, canonicalPath: f.path });
  expect(readFileSync(f.path, "utf8")).toBe("replacement");
  expect(after.dev).toBe(before.dev);
  expect(after.ino).toBe(before.ino);
  expect(after.mode).toBe(before.mode);
});

it("rejects oversized expected text and content before opening the file", () => {
  const f = fixture();
  const oversized = "x".repeat(8 * 1024 * 1024 + 1);
  expect(() => applyNativeDisk(request(f.root, f.path, f.path, oversized, "replacement"))).toThrow(/8 MiB/i);
  expect(() => applyNativeDisk(request(f.root, f.path, f.path, "disk original\n", oversized))).toThrow(/8 MiB/i);
  expect(readFileSync(f.path, "utf8")).toBe("disk original\n");
});

it("blocks nested editor roots after registration and expiry while allowing unrelated roots", async () => {
  const f = fixture();
  const nested = join(f.root, "nested"); mkdirSync(nested);
  const path = join(nested, "buffer.txt"); writeFileSync(path, "original");
  const sibling = fixture();
  const editors = new EditorConnections(); cleanups.push(() => editors.close());
  const bridge = new NativeEditorBridge(editors, f.root);
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    editors.register("nested", [nested]);
    for (const expired of [false, true]) {
      if (expired) { now += 6000; editors.register("unrelated", [sibling.root]); }
      expect(editors.hasRegisteredWorkspace(f.root)).toBe(true);
      await expect(bridge.handle({ kind: "apply_disk", path, expectedCanonicalPath: path, expectedText: "original", content: "changed" }, new AbortController().signal)).rejects.toThrow(/registered/i);
      expect(readFileSync(path, "utf8")).toBe("original");
    }
    const unrelated = fixture();
    expect(editors.hasRegisteredWorkspace(unrelated.root)).toBe(false);
    await expect(new NativeEditorBridge(editors, unrelated.root).handle({ kind: "apply_disk", path: unrelated.path, expectedCanonicalPath: unrelated.path, expectedText: "disk original\n", content: "changed" }, new AbortController().signal)).resolves.toMatchObject({ saved: true, text: "changed" });
  } finally { Date.now = originalNow; }
});

it("accepts a workspace alias only while its canonical target remains authorized", async () => {
  const f = fixture(), aliases = fixture();
  const alias = join(aliases.root, "workspace"); symlinkSync(f.root, alias);
  const editors = new EditorConnections(); cleanups.push(() => editors.close());
  const bridge = new NativeEditorBridge(editors, f.root);
  const input = { kind: "apply_disk", path: join(alias, "buffer.txt"), expectedCanonicalPath: f.path, expectedText: "disk original\n", content: "changed" };
  await expect(bridge.handle(input, new AbortController().signal)).resolves.toMatchObject({ saved: true });
  expect(readFileSync(f.path, "utf8")).toBe("changed");
  rmSync(alias); symlinkSync(aliases.root, alias);
  await expect(bridge.handle({ ...input, expectedText: "changed" }, new AbortController().signal)).rejects.toThrow(/target|canonical/i);
  expect(readFileSync(f.path, "utf8")).toBe("changed");
  expect(readFileSync(aliases.path, "utf8")).toBe("disk original\n");
});
