import { describe, expect, test } from "bun:test";
import {
  IOS_FILE_BINARY_REASON,
  IOS_FILE_DIRTY_CONFLICT_EN,
  IOS_FILE_DIRTY_CONFLICT_TH,
  IOS_FILE_EDITOR_HOST_API,
  IOS_FILE_OWNERSHIP_COPY,
  IOS_FILE_SAVE_REASON,
  IOS_FILE_UNAVAILABLE_COPY,
  iosFileEditorModel,
} from "../core/file-editor.ts";

describe("ios file editor copy", () => {
  test("states Mac ownership and never advertises a host file API", () => {
    expect(IOS_FILE_EDITOR_HOST_API).toBe(false);
    expect(IOS_FILE_OWNERSHIP_COPY).toBe("Mac owns the file buffer. This phone does not overwrite a workspace file until the host advertises a versioned patch.");
    expect(IOS_FILE_UNAVAILABLE_COPY).toContain("will not invent a workspace listing");
    expect(IOS_FILE_SAVE_REASON).toContain("disabled until the Mac advertises a versioned patch");
    expect(IOS_FILE_BINARY_REASON).toContain("download-only");
  });
});

describe("ios file editor model", () => {
  test("defaults to the honest unavailable empty state", () => {
    const model = iosFileEditorModel();
    expect(model.empty).toBe(true);
    expect(model.title).toBe("File");
    expect(model.hostApi).toBe(false);
    expect(model.path).toBe("");
    expect(model.version).toBeUndefined();
    expect(model.text).toBe("");
    expect(model.binary).toBe(false);
    expect(model.dirtyConflict).toBe(false);
    expect(model.ownership).toBe(IOS_FILE_OWNERSHIP_COPY);
    expect(model.emptyTitle).toBe("No versioned file on this phone");
    expect(model.emptyBody).toBe(IOS_FILE_UNAVAILABLE_COPY);
    expect(model.actions.find(action => action.id === "save")).toMatchObject({ enabled: false, reason: IOS_FILE_SAVE_REASON });
    expect(model.actions.find(action => action.id === "download")?.enabled).toBe(false);
  });

  test("incomplete advertised files stay on the unavailable empty sheet", () => {
    expect(iosFileEditorModel({}).empty).toBe(true);
    expect(iosFileEditorModel({ path: "src/card.ts" }).empty).toBe(true);
    expect(iosFileEditorModel({ path: "src/card.ts", version: "etag-1" }).empty).toBe(true);
    expect(iosFileEditorModel({ version: "etag-1", text: "export const n = 1;\n" }).empty).toBe(true);
    expect(iosFileEditorModel({ path: "src/card.ts", version: "etag-1" }).actions.every(action => action.enabled === false)).toBe(true);
  });

  test("binary files are download-only", () => {
    const model = iosFileEditorModel({ path: "shot.png", binary: true, text: "not text" });
    expect(model.empty).toBe(false);
    expect(model.binary).toBe(true);
    expect(model.text).toBe("");
    expect(model.actions.find(action => action.id === "save")).toMatchObject({ enabled: false, reason: IOS_FILE_BINARY_REASON });
    expect(model.actions.find(action => action.id === "download")).toMatchObject({ enabled: true, reason: IOS_FILE_BINARY_REASON });
  });

  test("downloadOnly matches binary and needs a path to enable download", () => {
    const withPath = iosFileEditorModel({ path: "notes.bin", downloadOnly: true });
    expect(withPath.binary).toBe(true);
    expect(withPath.text).toBe("");
    expect(withPath.actions.find(action => action.id === "save")?.enabled).toBe(false);
    expect(withPath.actions.find(action => action.id === "download")?.enabled).toBe(true);
    const noPath = iosFileEditorModel({ binary: true });
    expect(noPath.actions.find(action => action.id === "download")?.enabled).toBe(false);
    expect(noPath.actions.find(action => action.id === "save")?.enabled).toBe(false);
  });

  test("dirty conflict disables save and keeps Thai primary copy", () => {
    const model = iosFileEditorModel({ path: "src/card.ts", version: "etag-1", text: "export const n = 1;\n", macDirty: true });
    expect(model.dirtyConflict).toBe(true);
    expect(model.conflictCopy.startsWith(IOS_FILE_DIRTY_CONFLICT_TH)).toBe(true);
    expect(model.conflictCopy).toContain(IOS_FILE_DIRTY_CONFLICT_EN);
    expect(model.actions.find(action => action.id === "save")?.enabled).toBe(false);
  });

  test("typed text without an advertised version is a dirty conflict", () => {
    const model = iosFileEditorModel({ path: "src/card.ts", text: "draft" });
    expect(model.empty).toBe(false);
    expect(model.dirtyConflict).toBe(true);
    expect(model.text).toBe("draft");
    expect(model.actions.find(action => action.id === "save")?.enabled).toBe(false);
  });

  test("save is never enabled while hostApi is false", () => {
    const inputs = [
      undefined,
      { path: "src/card.ts", version: "etag-1", text: "export const n = 1;\n" },
      { path: "src/card.ts", version: "etag-1", text: "export const n = 1;\n", macDirty: true },
      { path: "shot.png", binary: true },
      { path: "src/card.ts", text: "typed" },
    ];
    for (const input of inputs) {
      const model = iosFileEditorModel(input);
      expect(model.hostApi).toBe(false);
      expect(IOS_FILE_EDITOR_HOST_API).toBe(false);
      expect(model.actions.find(action => action.id === "save")?.enabled).toBe(false);
    }
  });

  test("versioned text still does not enable save", () => {
    const model = iosFileEditorModel({ path: "src/card.ts", version: "etag-1", text: "export const n = 1;\n" });
    expect(model.empty).toBe(false);
    expect(model.binary).toBe(false);
    expect(model.dirtyConflict).toBe(false);
    expect(model.path).toBe("src/card.ts");
    expect(model.version).toBe("etag-1");
    expect(model.text).toBe("export const n = 1;\n");
    expect(model.hostApi).toBe(false);
    expect(model.actions.find(action => action.id === "save")).toMatchObject({ enabled: false, reason: IOS_FILE_SAVE_REASON });
    expect(model.actions.find(action => action.id === "download")?.enabled).toBe(false);
  });
});
