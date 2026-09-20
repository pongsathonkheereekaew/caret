import {
  COMMIT_NO_CONTRACT_REASON,
  REVIEW_NO_GIT_REASON,
  parsePorcelainStatus,
  parseUnifiedDiff,
  type ReviewFile,
  type ReviewFileStatus,
} from "../../../macos/src/review-snapshot.ts";
import { isRecord } from "./types.ts";

export { COMMIT_NO_CONTRACT_REASON, REVIEW_NO_GIT_REASON };

/** Host GET /review is advertised; apply, stage, and commit stay disabled. */
export const IOS_REVIEW_HOST_API = true;

const BINARY_EXT = /\.(png|jpe?g|gif|webp|pdf|zip|gz|woff2?|mp3|mp4|mov|wasm|ico|icns|dylib|so|exe|bin)$/i;

export interface HostReviewPayload {
  readonly available: boolean;
  readonly branch?: string;
  readonly diff?: string;
  readonly untracked?: readonly { path: string; text?: string; binary: boolean }[];
}

export const IOS_REVIEW_OWNERSHIP_COPY =
  "Mac owns Git apply. This phone does not merge, stage, commit, or push.";

export const IOS_REVIEW_UNAVAILABLE_COPY =
  "No Git changes on this phone. Open Changes on the Mac. Cedia will not apply, stage, or commit from iOS.";

export const IOS_REVIEW_APPLY_REASON =
  "Mac owns Git apply. This phone does not apply, merge, stage, commit, or push.";

export const IOS_REVIEW_DIFF_NOTE = "Read-only diff from the Mac host.";
export const IOS_REVIEW_DIFF_EMPTY_NOTE = "No hunks in this review.";

export type IosReviewActionId = "apply" | "stage" | "commit";
export type IosReviewHunkLineType = "ctx" | "add" | "del";

export interface IosReviewHunkLine {
  readonly type: IosReviewHunkLineType;
  readonly text: string;
}

export interface IosReviewHunk {
  readonly path: string;
  readonly header: string;
  readonly lines: readonly IosReviewHunkLine[];
}

export interface IosReviewAction {
  readonly id: IosReviewActionId;
  readonly label: string;
  readonly enabled: false;
  readonly reason: string;
}

export interface IosReviewFileRow {
  readonly path: string;
  readonly status: ReviewFile["status"];
  readonly staged: boolean;
  readonly unstaged: boolean;
  readonly binaryHint: boolean;
  readonly statusLabel: string;
}

export interface IosReviewSheetModel {
  readonly title: string;
  readonly kicker: string;
  readonly ownership: string;
  readonly empty: boolean;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly files: readonly IosReviewFileRow[];
  readonly hunks: readonly IosReviewHunk[];
  readonly diffEmpty: boolean;
  readonly diffNote: string;
  readonly actions: readonly IosReviewAction[];
}

function statusLabel(status: ReviewFile["status"]): string {
  if (status === "modified") return "Modified";
  if (status === "added") return "Added";
  if (status === "deleted") return "Deleted";
  if (status === "renamed") return "Renamed";
  if (status === "untracked") return "Untracked";
  if (status === "conflict") return "Conflict";
  return "Unknown";
}

export function iosReviewFileRows(files: readonly ReviewFile[]): readonly IosReviewFileRow[] {
  return files.map(file => ({
    path: file.path,
    status: file.status,
    staged: file.staged,
    unstaged: file.unstaged,
    binaryHint: file.binaryHint,
    statusLabel: statusLabel(file.status),
  }));
}

/** Maps porcelain text only. Empty or missing stdout never invents a repository. */
export function iosReviewRowsFromPorcelain(stdout: string | undefined): readonly IosReviewFileRow[] {
  if (!stdout) return [];
  return iosReviewFileRows(parsePorcelainStatus(stdout));
}

export function iosReviewActions(input: { readonly noGit?: boolean } = {}): readonly IosReviewAction[] {
  return [
    { id: "apply", label: "Apply", enabled: false, reason: IOS_REVIEW_APPLY_REASON },
    { id: "stage", label: "Stage", enabled: false, reason: input.noGit ? REVIEW_NO_GIT_REASON : IOS_REVIEW_APPLY_REASON },
    { id: "commit", label: "Commit", enabled: false, reason: COMMIT_NO_CONTRACT_REASON },
  ];
}

function classifyHunkLine(raw: string): IosReviewHunkLine {
  if (raw.startsWith("+") && !raw.startsWith("+++")) return { type: "add", text: raw.slice(1) };
  if (raw.startsWith("-") && !raw.startsWith("---")) return { type: "del", text: raw.slice(1) };
  if (raw.startsWith(" ")) return { type: "ctx", text: raw.slice(1) };
  return { type: "ctx", text: raw.startsWith("\\") ? raw.slice(1) : raw };
}

function hostDiffPath(block: string): string | undefined {
  const header = block.match(/^diff --git a\/(.+) b\/(.+)$/m);
  if (!header?.[1] || !header[2]) return undefined;
  const fromPath = header[1];
  const toPath = header[2];
  return /^deleted file mode /m.test(block) || /^\+\+\+ \/dev\/null/m.test(block) ? fromPath : toPath;
}

/** Parses host unified diffs only. Paths come from `diff --git`; prose never becomes a file. */
export function iosReviewHunks(diff?: string): readonly IosReviewHunk[] {
  if (!diff) return [];
  const hunks: IosReviewHunk[] = [];
  for (const block of diff.split(/(?=^diff --git )/m)) {
    const path = hostDiffPath(block);
    if (!path) continue;
    for (const hunk of parseUnifiedDiff(block)) {
      hunks.push({
        path,
        header: hunk.header,
        lines: hunk.lines.map(classifyHunkLine),
      });
    }
  }
  return hunks;
}

export function parseHostReview(body: unknown): HostReviewPayload {
  if (!isRecord(body) || body.available !== true) return { available: false };
  const review: {
    available: true;
    branch?: string;
    diff?: string;
    untracked?: { path: string; text?: string; binary: boolean }[];
  } = { available: true };
  if (typeof body.branch === "string") review.branch = body.branch;
  if (typeof body.diff === "string") review.diff = body.diff;
  if (Array.isArray(body.untracked)) {
    const untracked = body.untracked.flatMap((item): { path: string; text?: string; binary: boolean }[] => {
      if (!isRecord(item) || typeof item.path !== "string" || !item.path.trim() || typeof item.binary !== "boolean") return [];
      return [{ path: item.path, binary: item.binary, ...(typeof item.text === "string" ? { text: item.text } : {}) }];
    });
    review.untracked = untracked;
  }
  return review;
}

function reviewFile(
  path: string,
  status: ReviewFileStatus,
  tracked: boolean,
  staged: boolean,
  unstaged: boolean,
  binaryHint: boolean,
): ReviewFile {
  return { path, status, tracked, staged, unstaged, binaryHint };
}

function filesFromHostDiff(diff: string): ReviewFile[] {
  const files: ReviewFile[] = [];
  const blocks = diff.split(/(?=^diff --git )/m);
  for (const block of blocks) {
    const header = block.match(/^diff --git a\/(.+) b\/(.+)$/m);
    if (!header?.[1] || !header[2]) continue;
    const fromPath = header[1];
    const toPath = header[2];
    let status: ReviewFileStatus = "modified";
    if (/^new file mode /m.test(block) || /^--- \/dev\/null/m.test(block)) status = "added";
    else if (/^deleted file mode /m.test(block) || /^\+\+\+ \/dev\/null/m.test(block)) status = "deleted";
    else if (/^rename (?:from|to) /m.test(block) || fromPath !== toPath) status = "renamed";
    const path = status === "deleted" ? fromPath : toPath;
    const binaryHint = BINARY_EXT.test(path) || /^Binary files /m.test(block);
    files.push(reviewFile(path, status, true, false, true, binaryHint));
  }
  return files;
}

export function reviewFilesFromHostReview(review: HostReviewPayload): ReviewFile[] {
  if (!review.available) return [];
  const files = review.diff ? filesFromHostDiff(review.diff) : [];
  for (const item of review.untracked ?? []) {
    if (!item.path.trim()) continue;
    files.push(reviewFile(item.path, "untracked", false, false, false, item.binary || BINARY_EXT.test(item.path)));
  }
  return files;
}

export function iosReviewSheetFromHost(review: HostReviewPayload): IosReviewSheetModel {
  return iosReviewSheetModel({
    files: reviewFilesFromHostReview(review),
    noGit: !review.available,
    hostReviewAvailable: review.available,
    diff: review.available ? review.diff : undefined,
  });
}

export function iosReviewSheetModel(input: {
  readonly files?: readonly ReviewFile[];
  readonly porcelain?: string;
  readonly noGit?: boolean;
  readonly hostReviewAvailable?: boolean;
  readonly diff?: string;
} = {}): IosReviewSheetModel {
  const files = input.files
    ? iosReviewFileRows(input.files)
    : iosReviewRowsFromPorcelain(input.porcelain);
  const hunks = iosReviewHunks(input.diff);
  const empty = files.length === 0;
  const unavailable = empty && input.hostReviewAvailable !== true;
  const diffEmpty = hunks.length === 0;
  return {
    title: "Review",
    kicker: "CHANGES",
    ownership: IOS_REVIEW_OWNERSHIP_COPY,
    empty,
    emptyTitle: unavailable ? "No Git changes on this phone" : "No changed files",
    emptyBody: unavailable ? IOS_REVIEW_UNAVAILABLE_COPY : IOS_REVIEW_OWNERSHIP_COPY,
    files,
    hunks,
    diffEmpty,
    diffNote: diffEmpty ? IOS_REVIEW_DIFF_EMPTY_NOTE : IOS_REVIEW_DIFF_NOTE,
    actions: iosReviewActions({ noGit: input.noGit }),
  };
}
