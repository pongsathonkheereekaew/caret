import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export type ArtifactKind = "image" | "video" | "log" | "file";
export type ArtifactViewer = "image" | "video" | "text" | "default";

export interface Artifact {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly viewer: ArtifactViewer;
  readonly path: string;
  readonly absPath: string;
  readonly mime: string;
  readonly runId: string;
  readonly revision: string;
  readonly title: string;
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".mkv", ".m4v"]);
const LOG_EXT = new Set([".log", ".jsonl", ".out", ".err"]);

export const kindFromPath = (rel: string): ArtifactKind => {
  const ext = path.extname(rel).toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (LOG_EXT.has(ext) || /(^|[/\\])logs?[/\\]/i.test(rel) || /\.log\./i.test(rel)) return "log";
  return "file";
};

export const mimeFromPath = (rel: string): string => {
  const ext = path.extname(rel).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".m4v": "video/mp4",
    ".log": "text/plain",
    ".jsonl": "application/x-ndjson",
    ".txt": "text/plain",
    ".md": "text/markdown",
  };
  return map[ext] ?? "application/octet-stream";
};

export const viewerForKind = (kind: ArtifactKind): ArtifactViewer => {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "log") return "text";
  return "default";
};

/** Refuse path traversal; identity is the resolved path under workDir. */
export const resolveUnderWorkDir = (workDir: string, candidate: string): string => {
  const root = fs.existsSync(workDir) ? fs.realpathSync(workDir) : path.resolve(workDir);
  const abs = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(workDir, candidate);
  const real = fs.existsSync(abs) ? fs.realpathSync(abs) : abs;
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error(`artifact path escapes workDir: ${candidate}`);
  }
  return real;
};

export const extractJournalPaths = (journal: ReadonlyArray<unknown>): string[] => {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "string") {
        if (
          child.length > 0 &&
          child.length < 512 &&
          !child.includes("\n") &&
          /(^path$|^file$|Path$|File$|logfile$|artifact)/i.test(key)
        ) {
          out.push(child);
        }
      } else {
        walk(child);
      }
    }
  };
  for (const event of journal) walk(event);
  return [...new Set(out)];
};

const gitLines = (workDir: string, args: ReadonlyArray<string>): string[] => {
  try {
    return execFileSync("git", args, { cwd: workDir, stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const listChangedPaths = (workDir: string, fromRef: string): string[] => {
  const tracked = fromRef
    ? gitLines(workDir, ["diff", "--name-only", fromRef, "HEAD"])
    : [];
  const untracked = gitLines(workDir, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])];
};

const toRel = (workDir: string, abs: string): string =>
  path.relative(workDir, abs).split(path.sep).join("/");

export const collectArtifacts = (params: {
  readonly runId: string;
  readonly revision: string;
  readonly workDir: string;
  readonly changed?: ReadonlyArray<string>;
  readonly journal?: ReadonlyArray<unknown>;
}): Artifact[] => {
  const workDir = fs.existsSync(params.workDir) ? fs.realpathSync(params.workDir) : path.resolve(params.workDir);
  const seen = new Set<string>();
  const items: Artifact[] = [];
  const add = (candidate: string): void => {
    let abs: string;
    try {
      abs = resolveUnderWorkDir(workDir, candidate);
    } catch {
      return;
    }
    if (seen.has(abs) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return;
    seen.add(abs);
    const rel = toRel(workDir, abs);
    const kind = kindFromPath(rel);
    items.push({
      id: `${params.runId}:${rel}`,
      kind,
      viewer: viewerForKind(kind),
      path: rel,
      absPath: abs,
      mime: mimeFromPath(rel),
      runId: params.runId,
      revision: params.revision,
      title: path.basename(rel),
    });
  };
  for (const rel of params.changed ?? []) add(rel);
  for (const rel of extractJournalPaths(params.journal ?? [])) add(rel);
  items.sort((a, b) => a.path.localeCompare(b.path));
  return items;
};
