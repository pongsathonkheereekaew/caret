import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectArtifacts,
  extractJournalPaths,
  kindFromPath,
  mimeFromPath,
  resolveUnderWorkDir,
  viewerForKind,
} from "./artifacts.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Artifacts", () => {
  it("maps extensions to kind, mime, and viewer", () => {
    expect(kindFromPath("shot.png")).toBe("image");
    expect(kindFromPath("clip.mp4")).toBe("video");
    expect(kindFromPath("run.log")).toBe("log");
    expect(kindFromPath("src/app.ts")).toBe("file");
    expect(viewerForKind("image")).toBe("image");
    expect(viewerForKind("video")).toBe("video");
    expect(viewerForKind("log")).toBe("text");
    expect(viewerForKind("file")).toBe("default");
    expect(mimeFromPath("a.webp")).toBe("image/webp");
    expect(mimeFromPath("a.mp4")).toBe("video/mp4");
  });

  it("binds changed files to run id and revision and skips missing paths", () => {
    const workDir = mkdtempSync(join(tmpdir(), "caret-art-"));
    dirs.push(workDir);
    writeFileSync(join(workDir, "shot.png"), "png");
    writeFileSync(join(workDir, "notes.md"), "hi");
    const items = collectArtifacts({
      runId: "caret-slice-1",
      revision: "refs/caret-slice/caret-slice-1/post-1",
      workDir,
      changed: ["shot.png", "notes.md", "gone.txt"],
    });
    expect(items.map((a) => a.kind)).toEqual(["file", "image"]);
    expect(items[1]).toMatchObject({
      id: "caret-slice-1:shot.png",
      runId: "caret-slice-1",
      revision: "refs/caret-slice/caret-slice-1/post-1",
      viewer: "image",
      path: "shot.png",
    });
  });

  it("picks journal path fields and refuses escape via symlink", () => {
    expect(
      extractJournalPaths([
        { type: "tool.completed", payload: { path: "logs/run.log", other: "ignore me" } },
      ]),
    ).toEqual(["logs/run.log"]);
    const workDir = mkdtempSync(join(tmpdir(), "caret-art-in-"));
    const outside = mkdtempSync(join(tmpdir(), "caret-art-out-"));
    dirs.push(workDir, outside);
    writeFileSync(join(outside, "secret.txt"), "no");
    symlinkSync(outside, join(workDir, "escape"));
    expect(() => resolveUnderWorkDir(workDir, "escape/secret.txt")).toThrow(/escapes workDir/);
  });

  it("includes untracked demo files from a real git worktree", () => {
    const workDir = mkdtempSync(join(tmpdir(), "caret-art-git-"));
    dirs.push(workDir);
    execFileSync("git", ["-c", "init.defaultBranch=main", "init"], { cwd: workDir, stdio: "ignore" });
    execFileSync("git", ["-c", "user.name=caret", "-c", "user.email=caret@test", "config", "user.name", "caret"], {
      cwd: workDir,
      stdio: "ignore",
    });
    writeFileSync(join(workDir, "base.txt"), "base\n");
    execFileSync("git", ["add", "base.txt"], { cwd: workDir, stdio: "ignore" });
    execFileSync(
      "git",
      ["-c", "user.name=caret", "-c", "user.email=caret@test", "-c", "commit.gpgsign=false", "commit", "-qm", "base"],
      { cwd: workDir, stdio: "ignore" },
    );
    mkdirSync(join(workDir, "demo"));
    writeFileSync(join(workDir, "demo", "walkthrough.mp4"), "vid");
    const items = collectArtifacts({
      runId: "r1",
      revision: "HEAD",
      workDir,
      changed: ["demo/walkthrough.mp4"],
    });
    expect(items).toEqual([
      expect.objectContaining({ kind: "video", path: "demo/walkthrough.mp4", viewer: "video" }),
    ]);
  });
});
