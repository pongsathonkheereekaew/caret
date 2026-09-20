import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	decodeReviewDocId,
	encodeReviewDocId,
	looksBinary,
	NATIVE_DIFF_BINARY_REASON,
	nativeDiffPlan,
	reviewDiffTitle,
	reviewOriginalArgs,
	resolveReviewTarget,
	AGENT_EDIT_DIFF_SCHEME,
	agentEditDiffTitle,
	decodeAgentEditDocId,
	encodeAgentEditDocId,
	REVIEW_NO_WORKSPACE_REASON,
	REVIEW_OUTSIDE_WORKSPACE_REASON,
	safeReviewRef,
} from "../src/native-diff.ts";

describe("native diff document identity", () => {
	it("round-trips a workspace-relative path and ref", () => {
		const id = encodeReviewDocId({ ref: "HEAD", path: "src/sync/client.ts" });
		expect(id).toBe("cedia-review:/HEAD/src/sync/client.ts");
		expect(decodeReviewDocId(id)).toEqual({ ref: "HEAD", path: "src/sync/client.ts" });
	});

	it("survives spaces and unicode in the path", () => {
		const id = encodeReviewDocId({ ref: "HEAD", path: "src/my file งาน.ts" });
		expect(decodeReviewDocId(id)?.path).toBe("src/my file งาน.ts");
	});

	it("rejects ids that are not review documents", () => {
		expect(decodeReviewDocId("file:///tmp/a.ts")).toBeUndefined();
		expect(decodeReviewDocId("cedia-review:/HEAD")).toBeUndefined();
		expect(decodeReviewDocId("cedia-review:/")).toBeUndefined();
	});
});

describe("native diff plan", () => {
	it("opens a text diff and names both sides", () => {
		const plan = nativeDiffPlan({ path: "src/a.ts", missingOriginal: false });
		expect(plan.open).toBe(true);
		expect(plan.open && plan.title).toBe("src/a.ts (HEAD ↔ Working Tree)");
		expect(reviewDiffTitle("src/a.ts", true)).toBe("src/a.ts (new file ↔ Working Tree)");
	});

	it("refuses a binary diff instead of showing a misleading one", () => {
		const plan = nativeDiffPlan({ path: "logo.png", binary: true, missingOriginal: false });
		expect(plan.open).toBe(false);
		expect(plan.open === false && plan.reason).toBe(NATIVE_DIFF_BINARY_REASON);
	});

	it("flags a missing original for a new or untracked file", () => {
		const plan = nativeDiffPlan({ path: "notes.md", missingOriginal: true });
		expect(plan.open && plan.missingOriginal).toBe(true);
	});
});

describe("binary sniffing", () => {
	it("detects a NUL byte and accepts plain text", () => {
		expect(looksBinary("a\u0000b")).toBe(true);
		expect(looksBinary("export const x = 1;\n")).toBe(false);
	});
});

describe("review ref hardening", () => {
	it("passes through a normal ref and refuses anything that could act as a flag", () => {
		expect(safeReviewRef("HEAD")).toBe("HEAD");
		expect(safeReviewRef("main")).toBe("main");
		expect(safeReviewRef("--upload-pack=touch /tmp/x")).toBe("HEAD");
		expect(safeReviewRef("-c")).toBe("HEAD");
		expect(safeReviewRef("")).toBe("HEAD");
		expect(safeReviewRef("HEAD; rm -rf /")).toBe("HEAD");
	});
});

describe("review target decision", () => {
	it("requires an open workspace before opening a diff", () => {
		const decision = resolveReviewTarget({ relativePath: "src/a.ts" });
		expect(decision.open).toBe(false);
		expect(decision.open === false && decision.reason).toBe(REVIEW_NO_WORKSPACE_REASON);
	});

	it("refuses a path that escapes the task workspace", () => {
		for (const bad of ["../secrets.env", "../../etc/passwd", "/etc/passwd", ""]) {
			const decision = resolveReviewTarget({ relativePath: bad, cwd: "/tmp/ws" });
			expect(decision.open).toBe(false);
			expect(decision.open === false && decision.reason).toBe(REVIEW_OUTSIDE_WORKSPACE_REASON);
		}
	});

	it("opens a normal tracked change with a titled diff", () => {
		const decision = resolveReviewTarget({ relativePath: "src/a.ts", cwd: "/tmp/ws" });
		expect(decision.open && decision.path).toBe("src/a.ts");
		expect(decision.open && decision.title).toBe("src/a.ts (HEAD ↔ Working Tree)");
	});

	it("normalizes backslash separators from Windows-style inputs", () => {
		const decision = resolveReviewTarget({ relativePath: "src\\nested\\a.ts", cwd: "/tmp/ws" });
		expect(decision.open && decision.path).toBe("src/nested/a.ts");
	});

	it("propagates the binary refusal instead of opening a text diff", () => {
		const decision = resolveReviewTarget({ relativePath: "logo.png", cwd: "/tmp/ws", binary: true });
		expect(decision.open).toBe(false);
		expect(decision.open === false && decision.reason).toBe(NATIVE_DIFF_BINARY_REASON);
	});

	it("titles a brand new file as a new-file comparison", () => {
		const decision = resolveReviewTarget({ relativePath: "notes.md", cwd: "/tmp/ws", missingOriginal: true });
		expect(decision.open && decision.title).toBe("notes.md (new file ↔ Working Tree)");
	});
});

describe("original-side read against a real repository", () => {
	function fixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "cedia-native-diff-"));
		mkdirSync(join(dir, "src"), { recursive: true });
		execFileSync("git", ["init", "-q"], { cwd: dir });
		writeFileSync(join(dir, "src/app.ts"), "export const value = 1;\n");
		execFileSync("git", ["add", "-A"], { cwd: dir });
		execFileSync("git", ["-c", "user.email=a@b.c", "-c", "user.name=F", "commit", "-qm", "init"], { cwd: dir });
		// Change the working tree so a diff is meaningful.
		writeFileSync(join(dir, "src/app.ts"), "export const value = 2;\nexport const extra = true;\n");
		return dir;
	}

	it("returns the committed version, not the working tree", () => {
		const dir = fixture();
		try {
			const [subcommand, target] = reviewOriginalArgs("HEAD", "src/app.ts");
			const original = execFileSync("git", ["-C", dir, subcommand!, target!], { encoding: "utf8" });
			expect(original).toBe("export const value = 1;\n");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("yields no original for a path the ref does not contain", () => {
		const dir = fixture();
		try {
			writeFileSync(join(dir, "src/new.ts"), "export const fresh = true;\n");
			const [subcommand, target] = reviewOriginalArgs("HEAD", "src/new.ts");
			let failed = false;
			try {
				execFileSync("git", ["-C", dir, subcommand!, target!], { stdio: "pipe" });
			} catch {
				failed = true;
			}
			// The provider maps this failure to an empty original (all-added diff).
			expect(failed).toBe(true);
			expect(nativeDiffPlan({ path: "src/new.ts", missingOriginal: true }).open).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("cannot be turned into an arbitrary command by a hostile ref", () => {
		const dir = fixture();
		try {
			const [subcommand, target] = reviewOriginalArgs("--output=/tmp/cedia-pwned", "src/app.ts");
			expect(target).toBe("HEAD:src/app.ts");
			const original = execFileSync("git", ["-C", dir, subcommand!, target!], { encoding: "utf8" });
			expect(original).toBe("export const value = 1;\n");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("Cedia edit review diff", () => {
	it("round-trips the edited document id through the virtual scheme", () => {
		const uri = "file:///private/tmp/ws/src/greet.ts";
		const id = encodeAgentEditDocId(uri);
		expect(id.startsWith(`${AGENT_EDIT_DIFF_SCHEME}:/`)).toBe(true);
		expect(decodeAgentEditDocId(id)).toBe(uri);
	});

	it("rejects a foreign or malformed id", () => {
		expect(decodeAgentEditDocId("cedia-review:/HEAD/src/greet.ts")).toBeUndefined();
		expect(decodeAgentEditDocId(`${AGENT_EDIT_DIFF_SCHEME}:/`)).toBeUndefined();
		expect(decodeAgentEditDocId(`${AGENT_EDIT_DIFF_SCHEME}:/no-scheme-here`)).toBeUndefined();
	});

	it("names both sides of the Cedia edit in the title", () => {
		expect(agentEditDiffTitle("src/greet.ts")).toBe("src/greet.ts (before Cedia ↔ after Cedia)");
	});
});
