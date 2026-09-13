/** Host GET/PATCH file is not advertised; Save stays disabled. */
export const IOS_FILE_EDITOR_HOST_API = false;

export const IOS_FILE_OWNERSHIP_COPY =
  "Mac owns the file buffer. This phone does not overwrite a workspace file until the host advertises a versioned patch.";

export const IOS_FILE_SAVE_REASON =
  "Save stays disabled until the Mac advertises a versioned patch for this path.";

export const IOS_FILE_BINARY_REASON =
  "Binary files are download-only on this phone. Caret will not open them as text.";

export const IOS_FILE_DIRTY_CONFLICT_TH = "ไฟล์มีการแก้ไขใหม่ ยังไม่ได้นำข้อเสนอไปใช้";
export const IOS_FILE_DIRTY_CONFLICT_EN = "The file has newer edits. Caret will not overwrite the Mac buffer.";

export const IOS_FILE_UNAVAILABLE_COPY =
  "No versioned file is advertised on this phone. Open the file on the Mac. Caret will not invent a workspace listing.";

export interface IosFileEditorInput {
  readonly path?: string;
  readonly version?: string;
  readonly text?: string;
  readonly binary?: boolean;
  readonly macDirty?: boolean;
  readonly downloadOnly?: boolean;
}

export interface IosFileEditorAction {
  readonly id: "save" | "download";
  readonly label: string;
  readonly enabled: boolean;
  readonly reason: string;
}

export interface IosFileEditorModel {
  readonly title: string;
  readonly kicker: string;
  readonly ownership: string;
  readonly path: string;
  readonly version?: string;
  readonly text: string;
  readonly binary: boolean;
  readonly dirtyConflict: boolean;
  readonly conflictCopy: string;
  readonly empty: boolean;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly actions: readonly IosFileEditorAction[];
  readonly hostApi: false;
}

function advertisedVersion(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function dirtyConflictCopy(dirty: boolean): string {
  if (!dirty) return "";
  return `${IOS_FILE_DIRTY_CONFLICT_TH} ${IOS_FILE_DIRTY_CONFLICT_EN}`;
}

export function iosFileEditorModel(input?: IosFileEditorInput): IosFileEditorModel {
  const path = typeof input?.path === "string" ? input.path : "";
  const version = advertisedVersion(input?.version);
  const hasText = typeof input?.text === "string";
  const binary = input?.binary === true || input?.downloadOnly === true;
  const macDirty = input?.macDirty === true;
  const dirtyConflict = macDirty || (hasText && version === undefined);
  const advertised = path.trim().length > 0 && version !== undefined && hasText;
  const empty = !binary && !dirtyConflict && !advertised;
  const conflictCopy = dirtyConflictCopy(dirtyConflict);
  const saveEnabled = IOS_FILE_EDITOR_HOST_API && version !== undefined && !binary && !macDirty;
  const saveReason = binary ? IOS_FILE_BINARY_REASON : IOS_FILE_SAVE_REASON;
  return {
    title: "File",
    kicker: "FILE",
    ownership: IOS_FILE_OWNERSHIP_COPY,
    path,
    ...(version !== undefined ? { version } : {}),
    text: binary || empty ? "" : (input?.text ?? ""),
    binary,
    dirtyConflict,
    conflictCopy,
    empty,
    emptyTitle: "No versioned file on this phone",
    emptyBody: IOS_FILE_UNAVAILABLE_COPY,
    actions: [
      { id: "save", label: "Save", enabled: saveEnabled, reason: saveReason },
      {
        id: "download",
        label: "Download",
        enabled: binary && path.trim().length > 0,
        reason: IOS_FILE_BINARY_REASON,
      },
    ],
    hostApi: false,
  };
}
