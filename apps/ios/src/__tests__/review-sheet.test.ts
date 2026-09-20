import { describe, expect, test } from "bun:test";
import {
  COMMIT_NO_CONTRACT_REASON,
  IOS_REVIEW_APPLY_REASON,
  IOS_REVIEW_DIFF_EMPTY_NOTE,
  IOS_REVIEW_DIFF_NOTE,
  IOS_REVIEW_HOST_API,
  IOS_REVIEW_OWNERSHIP_COPY,
  IOS_REVIEW_UNAVAILABLE_COPY,
  REVIEW_NO_GIT_REASON,
  iosReviewActions,
  iosReviewFileRows,
  iosReviewHunks,
  iosReviewRowsFromPorcelain,
  iosReviewSheetFromHost,
  iosReviewSheetModel,
  parseHostReview,
  reviewFilesFromHostReview,
} from "../core/review-sheet.ts";
import { parsePorcelainStatus } from "../../../macos/src/review-snapshot.ts";

describe("ios review copy", () => {
  test("states Mac ownership and never claims iOS Git apply", () => {
    expect(IOS_REVIEW_OWNERSHIP_COPY).toBe("Mac owns Git apply. This phone does not merge, stage, commit, or push.");
    expect(IOS_REVIEW_UNAVAILABLE_COPY).toBe("No Git changes on this phone. Open Changes on the Mac. Cedia will not apply, stage, or commit from iOS.");
    expect(IOS_REVIEW_HOST_API).toBe(true);
    expect(IOS_REVIEW_APPLY_REASON).toContain("This phone does not apply");
  });

  test("reuses Mac no-Git and no-commit-contract reasons", () => {
    expect(REVIEW_NO_GIT_REASON).toContain("not a Git repository");
    expect(REVIEW_NO_GIT_REASON).toContain("does not initialize a repository");
    expect(COMMIT_NO_CONTRACT_REASON).toContain("will not auto-push");
    const noGit = iosReviewActions({ noGit: true });
    expect(noGit.find(action => action.id === "stage")?.reason).toBe(REVIEW_NO_GIT_REASON);
    expect(noGit.find(action => action.id === "commit")?.reason).toBe(COMMIT_NO_CONTRACT_REASON);
  });
});

describe("ios review actions", () => {
  test("Apply, Stage, and Commit stay disabled with honest reasons", () => {
    const actions = iosReviewActions();
    expect(actions.map(action => action.id)).toEqual(["apply", "stage", "commit"]);
    expect(actions.every(action => action.enabled === false)).toBe(true);
    expect(actions.find(action => action.id === "apply")?.reason).toBe(IOS_REVIEW_APPLY_REASON);
    expect(actions.find(action => action.id === "stage")?.reason).toBe(IOS_REVIEW_APPLY_REASON);
    expect(actions.find(action => action.id === "commit")?.reason).toBe(COMMIT_NO_CONTRACT_REASON);
  });
});

describe("ios review row mapping", () => {
  test("maps porcelain files without inventing a repository", () => {
    const porcelain = [" M src/card.ts", "?? shot.png"].join("\n");
    const rows = iosReviewRowsFromPorcelain(porcelain);
    expect(rows).toEqual(iosReviewFileRows(parsePorcelainStatus(porcelain)));
    expect(rows).toEqual([
      { path: "src/card.ts", status: "modified", staged: false, unstaged: true, binaryHint: false, statusLabel: "Modified" },
      { path: "shot.png", status: "untracked", staged: false, unstaged: false, binaryHint: true, statusLabel: "Untracked" },
    ]);
  });

  test("empty or missing porcelain stays empty", () => {
    expect(iosReviewRowsFromPorcelain(undefined)).toEqual([]);
    expect(iosReviewRowsFromPorcelain("")).toEqual([]);
    expect(iosReviewRowsFromPorcelain("warning: ignore\n")).toEqual([]);
  });
});

describe("ios review sheet model", () => {
  test("defaults to the honest unavailable empty state", () => {
    const model = iosReviewSheetModel();
    expect(model.empty).toBe(true);
    expect(model.files).toEqual([]);
    expect(model.hunks).toEqual([]);
    expect(model.diffEmpty).toBe(true);
    expect(model.diffNote).toBe(IOS_REVIEW_DIFF_EMPTY_NOTE);
    expect(model.ownership).toBe(IOS_REVIEW_OWNERSHIP_COPY);
    expect(model.emptyBody).toBe(IOS_REVIEW_UNAVAILABLE_COPY);
    expect(model.actions.every(action => action.enabled === false)).toBe(true);
  });

  test("lists mapped files when porcelain is supplied", () => {
    const model = iosReviewSheetModel({ porcelain: "A  added.ts" });
    expect(model.empty).toBe(false);
    expect(model.files).toHaveLength(1);
    expect(model.files[0]?.path).toBe("added.ts");
    expect(model.files[0]?.statusLabel).toBe("Added");
  });
});

describe("ios host review mapping", () => {
  test("missing or invalid bodies never invent available:true", () => {
    expect(parseHostReview(undefined)).toEqual({ available: false });
    expect(parseHostReview({ available: "yes" })).toEqual({ available: false });
    expect(parseHostReview({ diff: "diff --git a/a.ts b/a.ts" })).toEqual({ available: false });
  });

  test("available:false stays on the unavailable empty copy", () => {
    const model = iosReviewSheetFromHost({ available: false, diff: "diff --git a/a.ts b/a.ts\n" });
    expect(reviewFilesFromHostReview({ available: false, diff: "diff --git a/a.ts b/a.ts\n" })).toEqual([]);
    expect(model.empty).toBe(true);
    expect(model.emptyTitle).toBe("No Git changes on this phone");
    expect(model.emptyBody).toBe(IOS_REVIEW_UNAVAILABLE_COPY);
    expect(model.actions.every(action => action.enabled === false)).toBe(true);
  });

  test("available:true with empty diff and untracked is No changed files", () => {
    const model = iosReviewSheetFromHost({ available: true, diff: "", untracked: [] });
    expect(model.empty).toBe(true);
    expect(model.emptyTitle).toBe("No changed files");
    expect(model.emptyBody).toBe(IOS_REVIEW_OWNERSHIP_COPY);
    expect(model.hunks).toEqual([]);
    expect(model.diffEmpty).toBe(true);
    expect(model.diffNote).toBe(IOS_REVIEW_DIFF_EMPTY_NOTE);
    expect(model.actions.every(action => action.enabled === false)).toBe(true);
  });

  test("maps diff --git paths and untracked rows without inventing prose files", () => {
    const review = parseHostReview({
      available: true,
      branch: "main",
      diff: [
        "Random prose about card.ts should not become a file.",
        "diff --git a/src/card.ts b/src/card.ts",
        "--- a/src/card.ts",
        "+++ b/src/card.ts",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        "diff --git a/gone.ts b/gone.ts",
        "deleted file mode 100644",
        "--- a/gone.ts",
        "+++ /dev/null",
        "diff --git a/shot.png b/shot.png",
        "Binary files a/shot.png and b/shot.png differ",
      ].join("\n"),
      untracked: [{ path: "notes.md", binary: false, text: "hi" }, { path: "photo.jpg", binary: true }],
    });
    expect(review.available).toBe(true);
    const files = reviewFilesFromHostReview(review);
    expect(files.map(file => file.path)).toEqual(["src/card.ts", "gone.ts", "shot.png", "notes.md", "photo.jpg"]);
    expect(files[0]).toMatchObject({ path: "src/card.ts", status: "modified", binaryHint: false });
    expect(files[1]).toMatchObject({ path: "gone.ts", status: "deleted" });
    expect(files[2]).toMatchObject({ path: "shot.png", status: "modified", binaryHint: true });
    expect(files[3]).toMatchObject({ path: "notes.md", status: "untracked", binaryHint: false });
    expect(files[4]).toMatchObject({ path: "photo.jpg", status: "untracked", binaryHint: true });
    const model = iosReviewSheetFromHost(review);
    expect(model.files).toHaveLength(5);
    expect(model.actions.map(action => action.enabled)).toEqual([false, false, false]);
    expect(model.hunks).toEqual([
      {
        path: "src/card.ts",
        header: "@@ -1 +1 @@",
        lines: [
          { type: "del", text: "old" },
          { type: "add", text: "new" },
        ],
      },
    ]);
    expect(model.diffEmpty).toBe(false);
    expect(model.diffNote).toBe(IOS_REVIEW_DIFF_NOTE);
  });
});

describe("ios review hunks", () => {
  const smallDiff = [
    "diff --git a/src/card.ts b/src/card.ts",
    "--- a/src/card.ts",
    "+++ b/src/card.ts",
    "@@ -1,2 +1,3 @@",
    " keep",
    "-old",
    "+new",
  ].join("\n");

  test("parses typed hunks from a small unified diff", () => {
    expect(iosReviewHunks(smallDiff)).toEqual([
      {
        path: "src/card.ts",
        header: "@@ -1,2 +1,3 @@",
        lines: [
          { type: "ctx", text: "keep" },
          { type: "del", text: "old" },
          { type: "add", text: "new" },
        ],
      },
    ]);
    const model = iosReviewSheetFromHost({ available: true, diff: smallDiff });
    expect(model.hunks).toEqual(iosReviewHunks(smallDiff));
    expect(model.diffEmpty).toBe(false);
    expect(model.diffNote).toBe(IOS_REVIEW_DIFF_NOTE);
    expect(model.actions.every(action => action.enabled === false)).toBe(true);
  });

  test("empty or missing diff stays diffEmpty", () => {
    expect(iosReviewHunks()).toEqual([]);
    expect(iosReviewHunks("")).toEqual([]);
    expect(iosReviewHunks("Random prose about card.ts should not become a file.")).toEqual([]);
    const model = iosReviewSheetFromHost({ available: true, diff: "", untracked: [] });
    expect(model.hunks).toEqual([]);
    expect(model.diffEmpty).toBe(true);
    expect(model.diffNote).toBe(IOS_REVIEW_DIFF_EMPTY_NOTE);
    expect(model.actions.every(action => action.enabled === false)).toBe(true);
  });

  test("unavailable host diffs do not invent hunks or Cloud", () => {
    const model = iosReviewSheetFromHost({ available: false, diff: smallDiff });
    expect(model.hunks).toEqual([]);
    expect(model.diffEmpty).toBe(true);
    expect(model.diffNote).toBe(IOS_REVIEW_DIFF_EMPTY_NOTE);
    expect(model.actions.every(action => action.enabled === false)).toBe(true);
    expect(JSON.stringify(model)).not.toMatch(/Cloud/i);
    expect(IOS_REVIEW_DIFF_NOTE).not.toMatch(/Cloud/i);
    expect(IOS_REVIEW_OWNERSHIP_COPY).not.toMatch(/Cloud/i);
  });
});
