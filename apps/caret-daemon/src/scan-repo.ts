import * as fs from "node:fs";
import * as path from "node:path";
import { canAttachToPrompt } from "./context-policy.ts";
import { isIgnored, parseIgnore } from "./ignore.ts";

export type ScanFailureReason = "unreadable" | "too-large" | "binary" | "cap";

export interface ScanFailure {
  readonly path: string;
  readonly reason: ScanFailureReason;
}

export interface ScanFile {
  readonly path: string;
  readonly text: string;
}

export interface ScanResult {
  readonly root: string;
  readonly files: ReadonlyArray<ScanFile>;
  readonly failures: ReadonlyArray<ScanFailure>;
  readonly skippedIgnored: number;
}

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "out", ".build", ".cursor"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".py", ".json", ".go", ".rs", ".txt"]);
export const MAX_INDEX_FILES = 40;
export const MAX_FILE_BYTES = 64_000;

export const readIgnorePatterns = (repoDir: string): string[] => {
  const names = [".caretignore", ".cursorignore", ".gitignore"];
  const patterns: string[] = [];
  for (const name of names) {
    try {
      patterns.push(...parseIgnore(fs.readFileSync(path.join(repoDir, name), "utf8")));
    } catch {
      /* absent */
    }
  }
  return patterns;
};

/** Walk one root. Ignored paths are skipped (not failures). Errors are failures. */
export const scanRepoTexts = (repoDir: string): ScanResult => {
  const files: ScanFile[] = [];
  const failures: ScanFailure[] = [];
  let skippedIgnored = 0;
  const patterns = readIgnorePatterns(repoDir);
  const walk = (dir: string): void => {
    if (files.length >= MAX_INDEX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      failures.push({ path: path.relative(repoDir, dir) || ".", reason: "unreadable" });
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_INDEX_FILES) {
        failures.push({ path: path.relative(repoDir, path.join(dir, entry.name)), reason: "cap" });
        return;
      }
      const full = path.join(dir, entry.name);
      const rel = path.relative(repoDir, full);
      if (entry.name.startsWith(".") && entry.name !== ".gitignore" && entry.name !== ".caretignore") {
        if (entry.isDirectory()) continue;
      }
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || isIgnored(`${rel}/`, patterns)) {
          skippedIgnored += 1;
          continue;
        }
        walk(full);
        continue;
      }
      if (!canAttachToPrompt({ ignored: isIgnored(rel, patterns), sandboxDenied: false })) {
        skippedIgnored += 1;
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXT.has(ext)) continue;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        failures.push({ path: rel, reason: "unreadable" });
        continue;
      }
      if (stat.size > MAX_FILE_BYTES) {
        failures.push({ path: rel, reason: "too-large" });
        continue;
      }
      let text: string;
      try {
        text = fs.readFileSync(full, "utf8");
      } catch {
        failures.push({ path: rel, reason: "unreadable" });
        continue;
      }
      if (text.includes("\0")) {
        failures.push({ path: rel, reason: "binary" });
        continue;
      }
      files.push({ path: rel, text });
    }
  };
  walk(repoDir);
  return { root: repoDir, files, failures, skippedIgnored };
};
