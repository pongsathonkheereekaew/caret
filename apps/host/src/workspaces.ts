import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export function within(root: string, path: string): boolean {
  const child = relative(resolve(root), resolve(path));
  return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}
export function workspacePath(cwd: string, name: string): string {
  const root = realpathSync(cwd);
  const lexicalRoot = resolve(cwd);
  const supplied = resolve(lexicalRoot, name);
  const candidate = within(lexicalRoot, supplied) ? resolve(root, relative(lexicalRoot, supplied)) : supplied;
  if (!within(root, candidate)) throw new Error("Path is outside this workspace");
  let ancestor = candidate;
  while (!existsSync(ancestor)) {
    // A dangling symlink is not a safe missing directory.
    try { if (lstatSync(ancestor).isSymbolicLink()) throw new Error("Dangling workspace symlink"); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    ancestor = dirname(ancestor);
  }
  const existing = realpathSync(ancestor);
  if (!within(root, existing)) throw new Error("Path resolves outside this workspace");
  return candidate;
}
function git(cwd: string, args: string[], input?: Buffer): Buffer {
  return execFileSync("git", ["-C", cwd, ...args], { input, maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
}
export function gitRoot(cwd: string): string | undefined {
  try { return git(cwd, ["rev-parse", "--show-toplevel"]).toString().trim(); } catch { return undefined; }
}

export interface WorkspaceSnapshot {
  cwd: string;
  root: string;
  branch: string;
  baseCommit: string;
  patchHash: string;
  files: { path: string; sha256: string; kind: "file" | "symlink" }[];
}
/** Create an isolated task worktree including the selected source's uncommitted state. */
export function createWorktree(source: string, destination: string, taskId: string): WorkspaceSnapshot {
  const root = gitRoot(source);
  if (!root) throw new Error("This folder is not a Git repository; use local mode");
  const baseCommit = git(root, ["rev-parse", "HEAD"]).toString().trim();
  const patch = git(root, ["diff", "--no-ext-diff", "--binary", "HEAD"]);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean);
  const branch = `caret/task-${taskId}`;
  const prepared: { name: string; source: string; kind: "file" | "symlink"; hash: string }[] = [];
  let bytes = patch.length;
  for (const name of untracked) {
    const path = workspacePath(root, name);
    const stat = lstatSync(path);
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`Unsupported snapshot entry: ${name}`);
    const kind = stat.isSymbolicLink() ? "symlink" : "file";
    const content = kind === "symlink" ? Buffer.from(readlinkSync(path)) : readFileSync(path);
    bytes += content.length;
    if (bytes > 256 * 1024 * 1024) throw new Error("Workspace snapshot exceeds 256 MiB; select a smaller source snapshot");
    prepared.push({ name, source: path, kind, hash: createHash("sha256").update(content).digest("hex") });
  }
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  git(root, ["worktree", "add", "-b", branch, destination, baseCommit]);
  try {
    if (patch.length) git(destination, ["apply", "--binary", "-"], patch);
    for (const file of prepared) {
      const target = workspacePath(destination, file.name);
      mkdirSync(dirname(target), { recursive: true });
      if (file.kind === "symlink") {
        const link = readlinkSync(file.source);
        if (isAbsolute(link) || !within(destination, resolve(dirname(target), link))) throw new Error(`Symlink escapes task workspace: ${file.name}`);
        symlinkSync(link, target);
      } else copyFileSync(file.source, target);
      const actual = createHash("sha256").update(file.kind === "symlink" ? readlinkSync(target) : readFileSync(target)).digest("hex");
      if (actual !== file.hash) throw new Error(`Source changed during snapshot: ${file.name}`);
    }
    if (!git(root, ["diff", "--no-ext-diff", "--binary", "HEAD"]).equals(patch)) throw new Error("Tracked source changed during snapshot; retry from a stable revision");
    const result: WorkspaceSnapshot = { cwd: resolve(destination, relative(root, realpathSync(source))), root: destination,
      branch, baseCommit, patchHash: createHash("sha256").update(patch).digest("hex"), files: prepared.map(file => ({ path: file.name, sha256: file.hash, kind: file.kind })) };
    return result;
  } catch (error) {
    // Only remove the new, unexposed fixture worktree created by this operation.
    try { git(root, ["worktree", "remove", "--force", destination]); git(root, ["branch", "-D", branch]); } catch { /* Report original failure; never reset source. */ }
    throw error;
  }
}

export function reviewWorkspace(cwd: string): { available: boolean; branch?: string; diff?: string; untracked?: { path: string; text?: string; binary: boolean }[] } {
  const root = gitRoot(cwd);
  if (!root) return { available: false };
  const names = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean);
  const untracked = names.slice(0, 200).map(name => {
    const path = workspacePath(root, name);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 1024 * 1024) return { path: name, binary: true };
    const bytes = readFileSync(path);
    const binary = bytes.includes(0);
    return { path: name, binary, ...(binary ? {} : { text: bytes.toString("utf8") }) };
  });
  return { available: true, branch: git(root, ["branch", "--show-current"]).toString().trim(),
    diff: git(root, ["diff", "--no-ext-diff", "HEAD"]).toString(), untracked };
}

export function saveSnapshotManifest(path: string, snapshot: WorkspaceSnapshot): void {
  writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n", { mode: 0o600 });
}
