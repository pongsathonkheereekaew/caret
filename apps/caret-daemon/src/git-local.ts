// Caret local git lifecycle (REV-06 seed): commit + file-remote sync over
// the real git binary in the caller's checkout. No hosting API here
// (forge.ts owns Gitea); hosted origin + webhook autopilot stay
// blocked-external. Identity comes from the repo config — when none is
// set, git fails loudly instead of this module inventing an author.
// execFile directly, never a shell.
import { execFile } from "node:child_process";

export class GitLocalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitLocalError";
  }
}

const run = (cwd: string, args: ReadonlyArray<string>): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile("git", [...args], { cwd, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        const tail = String(stderr || error.message).trim().split("\n").slice(-4).join("\n");
        reject(new GitLocalError(`git ${args[0] ?? ""} failed: ${tail}`));
      } else {
        resolve(stdout);
      }
    });
  });

/** Stage everything (tracked + untracked) and commit. Returns the new sha. */
export const gitCommit = async (repoDir: string, message: string): Promise<string> => {
  if (!message.trim()) throw new GitLocalError("commit needs a non-empty message");
  await run(repoDir, ["add", "-A"]);
  const status = (await run(repoDir, ["status", "--porcelain=v1"])).trim();
  if (!status) throw new GitLocalError("nothing to commit (clean worktree)");
  await run(repoDir, ["commit", "-m", message]);
  return (await run(repoDir, ["rev-parse", "HEAD"])).trim();
};

export interface GitSyncStatus {
  readonly branch: string;
  readonly clean: boolean;
  /** Upstream ref (e.g. origin/main), or null when the branch tracks nothing. */
  readonly upstream: string | null;
  readonly ahead: number;
  readonly behind: number;
}

/** Branch, cleanliness, and ahead/behind vs the tracking upstream. */
export const gitSyncStatus = async (repoDir: string): Promise<GitSyncStatus> => {
  const porcelain = await run(repoDir, ["status", "--porcelain=v1", "-b"]);
  const lines = porcelain.split("\n");
  const head = lines[0] ?? "";
  const branch = head.startsWith("## ") ? head.slice(3).split("...")[0] ?? "" : "";
  const upstream = head.includes("...") ? (head.slice(3).split(" ")[0]?.split("...")[1] ?? null) : null;
  const clean = lines.slice(1).every((line) => !line.trim());
  if (!upstream) return { branch, clean, upstream: null, ahead: 0, behind: 0 };
  const counts = (await run(repoDir, ["rev-list", "--left-right", "--count", `HEAD...@{upstream}`])).trim().split(/\s+/);
  return {
    branch,
    clean,
    upstream,
    ahead: Number(counts[0] ?? 0),
    behind: Number(counts[1] ?? 0),
  };
};

/** Push the current branch; rejection (e.g. non-fast-forward) throws loudly. */
export const gitPush = async (repoDir: string, remote = "origin"): Promise<string> => {
  const status = await gitSyncStatus(repoDir);
  if (!status.branch) throw new GitLocalError("cannot push: detached HEAD or unknown branch");
  if (status.upstream) {
    await run(repoDir, ["push", remote, status.branch]);
  } else {
    await run(repoDir, ["push", "--set-upstream", remote, status.branch]);
  }
  const remoteSha = (await run(repoDir, ["ls-remote", remote, status.branch])).trim().split(/\s+/)[0] ?? "";
  if (!remoteSha) throw new GitLocalError(`push ok but ${remote}/${status.branch} unreadable after push`);
  return remoteSha;
};

/** Fetch the remote (updates tracking refs; never merges). */
export const gitFetch = async (repoDir: string, remote = "origin"): Promise<void> => {
  await run(repoDir, ["fetch", remote]);
};
