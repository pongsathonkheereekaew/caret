import { afterEach, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EditorConnections } from "../src/editors.ts";
import { NativeEditorBridge } from "../src/native-editor.ts";
import type { EditorDocumentSnapshot } from "../../../packages/protocol/src/editor.ts";
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "caret-native-editor-")));
  const path = join(root, "buffer.txt"); writeFileSync(path, "disk original");
  const editors = new EditorConnections();
  cleanups.push(() => { editors.close(); rmSync(root, { recursive: true, force: true }); });
  const bridge = new NativeEditorBridge(editors, root);
  const document: EditorDocumentSnapshot = { handle: { id: "buffer-1", uri: `file://${path}` }, uri: `file://${path}`, path, workspaceRoot: root, text: "unsaved\n😀", documentVersion: 3, sha256: hash("unsaved\n😀"), dirty: true, isUntitled: false, languageId: "plaintext", encoding: "utf8" };
  const signal = new AbortController().signal;
  const respondRead = (snapshot = document) => {
    const request = editors.poll("window")[0]!; expect(request.kind).toBe("read");
    editors.respond("window", { kind: "read", requestId: request.requestId, document: snapshot });
  };
  return { root, path, editors, bridge, document, signal, respondRead };
}
it("uses unsaved snapshots and applies one guarded UTF-16 transaction without changing disk", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const snapshot = f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal); f.respondRead();
  expect(await snapshot).toEqual({ document: f.document, editorWorkspace: true });
  const applied = f.bridge.handle({ kind: "apply", path: f.path, handle: f.document.handle, expectedVersion: 3, expectedHash: f.document.sha256, content: "replacement" }, f.signal);
  f.respondRead(); await Promise.resolve(); await Promise.resolve();
  const request = f.editors.poll("window")[0]!;
  expect(request).toMatchObject({ kind: "apply", expectedVersion: 3, expectedHash: f.document.sha256, edits: [{ range: { start: { line: 0, character: 0 }, end: { line: 1, character: 2 } }, text: "replacement" }] });
  f.editors.respond("window", { kind: "apply", requestId: request.requestId, document: { ...f.document, documentVersion: 4, sha256: hash("replacement") }, saved: false, undoPreserved: true });
  expect(await applied).toMatchObject({ text: "replacement", saved: false, undoPreserved: true });
  expect(readFileSync(f.path, "utf8")).toBe("disk original");
});
it("rejects stale snapshot edits before dispatching any apply", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const snapshot = f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal); f.respondRead(); await snapshot;
  const applied = f.bridge.handle({ kind: "apply", path: f.path, handle: f.document.handle, expectedVersion: 3, expectedHash: f.document.sha256, content: "replacement" }, f.signal);
  f.respondRead({ ...f.document, documentVersion: 4 });
  await expect(applied).rejects.toThrow(/changed/);
  expect(f.editors.poll("window")).toEqual([]);
});
it("allows untouched headless files but never falls back after an editor owner disconnects", async () => {
  const f = fixture();
  expect(await f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal)).toEqual({ document: null, editorWorkspace: false });
  f.editors.register("window", [f.root]);
  const pending = f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal); f.respondRead(); await pending;
  f.editors.close();
  await expect(f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal)).rejects.toThrow(/disconnected/);
});
it("keeps ownership after an interrupted first read instead of silently selecting stale disk", async () => {
  const f = fixture(); f.editors.register("window", [f.root]); const controller = new AbortController();
  const pending = f.bridge.handle({ kind: "snapshot", path: f.path }, controller.signal);
  controller.abort(); await expect(pending).rejects.toThrow(/cancelled/);
  f.editors.close();
  await expect(f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal)).rejects.toThrow(/disconnected/);
});
it("routes create, delete and move without writing disk from the host", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const createdPath = join(f.root, "created.ts");
  const pendingCreate = f.bridge.handle({ kind: "create", path: createdPath, content: "new\n" }, f.signal);
  const createRequest = f.editors.poll("window")[0]!;
  expect(createRequest.kind).toBe("create");
  f.editors.respond("window", { kind: "create", requestId: createRequest.requestId, document: { ...f.document, path: createdPath, uri: `file://${createdPath}`, text: "new\n", sha256: hash("new\n") }, saved: false, undoPreserved: true });
  expect(await pendingCreate).toMatchObject({ saved: false, undoPreserved: true });
  expect(readFileSync(f.path, "utf8")).toBe("disk original");

  const snapshot = f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal); f.respondRead(); await snapshot;
  const pendingDelete = f.bridge.handle({ kind: "delete", path: f.path, handle: f.document.handle, expectedVersion: 3, expectedHash: f.document.sha256 }, f.signal);
  f.respondRead(); await Promise.resolve(); await Promise.resolve();
  const deleteRequest = f.editors.poll("window")[0]!;
  expect(deleteRequest.kind).toBe("delete");
  f.editors.respond("window", { kind: "delete", requestId: deleteRequest.requestId, path: f.path, uri: f.document.uri });
  expect(await pendingDelete).toEqual({ deleted: true, path: f.path, uri: f.document.uri });
  expect(readFileSync(f.path, "utf8")).toBe("disk original");
});

it("snapshots untitled paths without realpath", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const untitled = { ...f.document, path: "untitled:Untitled-1", uri: "untitled:Untitled-1", isUntitled: true, handle: { id: "untitled-1", uri: "untitled:Untitled-1" } };
  const pending = f.bridge.handle({ kind: "snapshot", path: "untitled:Untitled-1" }, f.signal);
  const request = f.editors.poll("window")[0]!;
  expect(request).toMatchObject({ kind: "read", path: "untitled:Untitled-1" });
  f.editors.respond("window", { kind: "read", requestId: request.requestId, document: untitled });
  expect(await pending).toEqual({ document: untitled, editorWorkspace: true });
  const other = { ...untitled, path: "untitled:Untitled-2", uri: "untitled:Untitled-2", handle: { id: "untitled-2", uri: "untitled:Untitled-2" } };
  const wrong = f.bridge.handle({ kind: "snapshot", path: "untitled:Untitled-2" }, f.signal);
  const wrongRequest = f.editors.poll("window")[0]!;
  f.editors.respond("window", { kind: "read", requestId: wrongRequest.requestId, document: untitled });
  await expect(wrong).rejects.toThrow(/Invalid native editor snapshot/);
  expect(other.path).toBe("untitled:Untitled-2");
});

it("rejects moving an untitled document before any editor request", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const untitled = { ...f.document, path: "untitled:Untitled-1", uri: "untitled:Untitled-1", isUntitled: true, handle: { id: "untitled-1", uri: "untitled:Untitled-1" } };
  const pending = f.bridge.handle({ kind: "snapshot", path: "untitled:Untitled-1" }, f.signal); f.respondRead(untitled); await pending;
  const moved = f.bridge.handle({
    kind: "move",
    path: "untitled:Untitled-1",
    destination: join(f.root, "saved.ts"),
    handle: untitled.handle,
    expectedVersion: 3,
    expectedHash: untitled.sha256,
  }, f.signal);
  f.respondRead(untitled);
  await expect(moved).rejects.toThrow(/Untitled documents must be created at a workspace path before move/);
  expect(f.editors.poll("window")).toEqual([]);
});

it("rejects a snapshot whose content does not match its hash", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const pending = f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal);
  f.respondRead({ ...f.document, text: "corrupted" });
  await expect(pending).rejects.toThrow(/Invalid native editor snapshot/);
});

it("shares editor ownership across internal symlink aliases and rejects retargeting", async () => {
  const f = fixture(); const alias = join(f.root, "alias.txt"); symlinkSync(f.path, alias);
  f.editors.register("window", [f.root]);
  const pending = f.bridge.handle({ kind: "snapshot", path: alias }, f.signal); f.respondRead();
  expect(await pending).toEqual({ document: f.document, editorWorkspace: true });
  f.editors.close();
  await expect(f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal)).rejects.toThrow(/disconnected/);
  await expect(f.bridge.handle({ kind: "snapshot", path: alias }, f.signal)).rejects.toThrow(/disconnected/);
  unlinkSync(alias); const other = join(f.root, "other.txt"); writeFileSync(other, "other"); symlinkSync(other, alias);
  await expect(f.bridge.handle({ kind: "snapshot", path: alias }, f.signal)).rejects.toThrow(/changed its target/);
});
it("never converts an editor open failure into a headless disk fallback", async () => {
  const f = fixture(); f.editors.register("window", [f.root]);
  const pending = f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal);
  const request = f.editors.poll("window")[0]!;
  f.editors.respond("window", { kind: "error", requestId: request.requestId, error: { code: "unsupported_document", message: "cannot open" } });
  await expect(pending).rejects.toThrow(/unsupported_document/);
  f.editors.close();
  await expect(f.bridge.handle({ kind: "snapshot", path: f.path }, f.signal)).rejects.toThrow(/disconnected/);
});

it("retains a canonical workspace registration after the window expires", () => {
  const f = fixture();
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    f.editors.register("window", [f.root]);
    now += 6_000;
    expect(f.editors.hasConnection(f.root)).toBe(false);
    expect(f.editors.hasRegisteredWorkspace(f.root)).toBe(true);
  } finally { Date.now = originalNow; }
});
