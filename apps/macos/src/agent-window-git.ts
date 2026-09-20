import { execFile as nodeExecFile } from "node:child_process";
import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";

import type {
	GitListBranchesResult,
	GitListRecentCommitsResult,
	GitReadFileAtRevResult,
	GitReadWorkingTreeDiffResult,
	GitRunStackedActionResult,
	GitStatusResult,
	GitWorkingTreeDiffStatsResult,
} from "../agent-window/vendor/synara/packages/contracts/src/git.ts";

export const CEDIA_AGENT_GIT_EVENT_CHANNEL = "vscode:cediaAgentGit";
const execFile = promisify(nodeExecFile);
const MAX_GIT_OUTPUT_BYTES = 8 * 1024 * 1024;
const DEFAULT_GIT_TIMEOUT_MS = 30_000;

export interface AgentGitServiceOptions {
	readonly gitExecutable?: string;
	readonly timeoutMs?: number;
	readonly maxOutputBytes?: number;
	readonly now?: () => Date;
}

interface AgentSender {
	readonly send: (channel: string, event: unknown) => void;
	readonly isDestroyed?: () => boolean;
	readonly once?: (channel: string, listener: () => void) => void;
}

interface GitIpcEvent {
	readonly sender: AgentSender;
}

interface GitOutput {
	readonly stdout: string;
	readonly stderr: string;
	readonly truncated: boolean;
	readonly failed?: boolean;
	readonly code?: number | string;
}

interface GitStatusHeader {
	readonly branch: string | null;
	readonly upstream: string | null;
	readonly ahead: number;
	readonly behind: number;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Git request");
	return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength = 16_384): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
		throw new Error(`Invalid Git ${field}`);
	}
	return value;
}

function optionalText(value: unknown, field: string, maxLength = 16_384): string | undefined {
	return value === undefined ? undefined : text(value, field, maxLength);
}

function validateCwd(value: unknown): string {
	const cwd = text(value, "cwd");
	if (!isAbsolute(cwd)) throw new Error("Git cwd must be an absolute directory");
	const resolved = resolve(cwd);
	try {
		if (!statSync(resolved).isDirectory()) throw new Error("not a directory");
	} catch {
		throw new Error("Git cwd must be an existing directory");
	}
	return resolved;
}

function validateRevision(value: unknown, field = "revision"): string {
	const revision = text(value, field, 256);
	if (revision.startsWith("-")) throw new Error(`Invalid Git ${field}`);
	return revision;
}

function validateBranch(value: unknown): string {
	const branch = text(value, "branch", 256);
	if (branch.startsWith("-") || branch === "." || branch === ".." || branch.includes("..")) throw new Error("Invalid Git branch");
	return branch;
}

function validatePath(value: unknown): string {
	const path = text(value, "file path", 2_048);
	if (isAbsolute(path) || path.split(/[\\/]/).some(part => part === "..")) throw new Error("Git file path must stay inside the workspace");
	return path;
}

function actionFilePaths(value: unknown): string[] | null {
	// The Synara dialog uses null/omitted to mean "all changed files".
	if (value === undefined || value === null) return null;
	if (!Array.isArray(value) || value.length === 0) throw new Error("Git filePaths must contain at least one path");
	return value.map(path => validatePath(path));
}

function actionCommitMessage(value: unknown): string {
	// Synara can generate a message when the field is blank.  Keep that path
	// deterministic in the native bridge, so a blank dialog never mutates the
	// repository before failing validation.
	if (value === undefined || value === null) return "Update workspace";
	if (typeof value !== "string") throw new Error("Invalid Git commit message");
	if (value.trim().length === 0) return "Update workspace";
	if (value.length > 10_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error("Invalid Git commit message");
	return value.trim();
}

function senderFromEvent(event: unknown): AgentSender {
	const value = record(event);
	const candidate = value.sender;
	if (!candidate || typeof candidate !== "object" || typeof (candidate as AgentSender).send !== "function") throw new Error("Invalid Agent Window sender");
	const sender = candidate as AgentSender;
	if (sender.isDestroyed?.()) throw new Error("Agent Window sender is destroyed");
	return sender;
}

function parseCount(value: string | undefined): number {
	const count = Number(value ?? "0");
	return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function parseStatusHeader(value: string): GitStatusHeader {
	const header = value.trim().replace(/^##\s*/, "");
	if (!header || header.startsWith("HEAD (")) return { branch: null, upstream: null, ahead: 0, behind: 0 };
	const counts = /\[(.*?)\]/.exec(header)?.[1] ?? "";
	const ahead = parseCount(/\bahead\s+(\d+)/.exec(counts)?.[1]);
	const behind = parseCount(/\bbehind\s+(\d+)/.exec(counts)?.[1]);
	const withoutCounts = header.replace(/\s*\[.*\]\s*$/, "");
	const unborn = /^No commits yet on (.+)$/.exec(withoutCounts);
	if (unborn?.[1]) return { branch: unborn[1].trim(), upstream: null, ahead, behind };
	const marker = withoutCounts.indexOf("...");
	if (marker >= 0) {
		const branch = withoutCounts.slice(0, marker).trim() || null;
		const upstream = withoutCounts.slice(marker + 3).trim() || null;
		return { branch, upstream, ahead, behind };
	}
	const branch = withoutCounts.split(/\s+/)[0] || null;
	return { branch, upstream: null, ahead, behind };
}

function parseNumstat(value: string): Map<string, { insertions: number; deletions: number }> {
	const result = new Map<string, { insertions: number; deletions: number }>();
	const records = value.includes("\0") ? value.split("\0") : value.split(/\r?\n/);
	for (const line of records) {
		if (!line.trim()) continue;
		const fields = line.split("\t");
		if (fields.length < 3) continue;
		const rawPath = fields.slice(2).join("\t");
		const path = rawPath.includes(" -> ") ? rawPath.slice(rawPath.lastIndexOf(" -> ") + 4) : rawPath;
		const insertions = /^\d+$/.test(fields[0] ?? "") ? Number(fields[0]) : 0;
		const deletions = /^\d+$/.test(fields[1] ?? "") ? Number(fields[1]) : 0;
		const current = result.get(path) ?? { insertions: 0, deletions: 0 };
		result.set(path, { insertions: current.insertions + insertions, deletions: current.deletions + deletions });
	}
	return result;
}

function defaultBranchName(output: string): string | null {
	const value = output.trim();
	if (!value) return null;
	const prefix = "origin/";
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function parseWorktrees(value: string): Map<string, string> {
	const result = new Map<string, string>();
	let path: string | undefined;
	for (const line of value.split(/\r?\n/)) {
		if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
		if (line.startsWith("branch refs/heads/") && path) {
			result.set(line.slice("branch refs/heads/".length), path);
			path = undefined;
		}
	}
	return result;
}

function actionPhases(action: string, featureBranch = false): string[] {
	const phases: string[] = [];
	if (featureBranch) phases.push("branch");
	if (action === "commit" || action === "commit_push") phases.push("commit");
	if (action === "push" || action === "commit_push") phases.push("push");
	return phases;
}

function uniqueFeatureBranchName(branches: GitListBranchesResult["branches"]): string {
	const existing = new Set(branches.filter(branch => !branch.isRemote).map(branch => branch.name.toLowerCase()));
	const base = "cedia/update";
	if (!existing.has(base)) return base;
	let suffix = 2;
	while (existing.has(`${base}-${suffix}`)) suffix += 1;
	return `${base}-${suffix}`;
}

function isGitAction(value: unknown): value is "commit" | "push" | "commit_push" | "create_pr" | "commit_push_pr" {
	return value === "commit" || value === "push" || value === "commit_push" || value === "create_pr" || value === "commit_push_pr";
}

export function createAgentGitService(options: AgentGitServiceOptions = {}): {
	handle(event: unknown, method: string, input: unknown): Promise<unknown>;
	dispose(): void;
} {
	const executable = options.gitExecutable ?? "git";
	const timeoutMs = options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
	const maxOutputBytes = options.maxOutputBytes ?? MAX_GIT_OUTPUT_BYTES;
	const now = options.now ?? (() => new Date());
	let disposed = false;

	async function run(cwd: string, args: readonly string[], allowFailure = false, outputLimit = maxOutputBytes): Promise<GitOutput> {
		if (disposed) throw new Error("Git service is disposed");
		try {
			const result = await execFile(executable, [...args], {
				cwd,
				env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat", LC_ALL: "C" },
				encoding: "utf8",
				timeout: timeoutMs,
				maxBuffer: outputLimit,
				windowsHide: true,
			});
			return { stdout: String(result.stdout), stderr: String(result.stderr), truncated: false, failed: false };
		} catch (error) {
			if (allowFailure) {
				const failure = error as { stdout?: unknown; stderr?: unknown; code?: unknown };
				const code = typeof failure.code === "number" || typeof failure.code === "string" ? failure.code : undefined;
				const truncated = code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
				return { stdout: String(failure.stdout ?? ""), stderr: String(failure.stderr ?? ""), truncated, failed: true, ...(code !== undefined ? { code } : {}) };
			}
			const failure = error as { stderr?: unknown; message?: unknown; code?: unknown };
			const detail = String(failure.stderr ?? failure.message ?? "Git command failed").trim();
			throw new Error(detail || `Git command failed (${String(failure.code ?? "unknown")})`);
		}
	}

	async function status(input: Record<string, unknown>): Promise<GitStatusResult> {
		const cwd = validateCwd(input.cwd);
		const probe = await run(cwd, ["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"], true);
		if (probe.stderr.includes("not a git repository")) {
			return { branch: null, hasWorkingTreeChanges: false, workingTree: { files: [], insertions: 0, deletions: 0 }, hasUpstream: false, upstreamBranch: null, aheadCount: 0, behindCount: 0, pr: null };
		}
		if (probe.failed) throw new Error(probe.stderr.trim() || "Unable to read Git status");
		if (probe.stderr && !probe.stdout) throw new Error(probe.stderr.trim() || "Unable to read Git status");
		const records = probe.stdout.includes("\0") ? probe.stdout.split("\0") : probe.stdout.split(/\r?\n/);
		const header = parseStatusHeader(records[0] ?? "");
		const entries: string[] = [];
		for (let index = 1; index < records.length; index += 1) {
			const line = records[index] ?? "";
			if (line.length < 3 || line.startsWith("##")) continue;
			const statusCode = line.slice(0, 2);
			const rawPath = line.slice(3);
			// In NUL mode rename/copy records carry the old path in the following
			// record; the first path is the current path we expose to the UI.
			if (/^[RC]/.test(statusCode) && probe.stdout.includes("\0")) index += 1;
			const path = !probe.stdout.includes("\0") && rawPath.includes(" -> ")
				? rawPath.slice(rawPath.lastIndexOf(" -> ") + 4)
				: rawPath;
			if (path) entries.push(path);
		}
		const [unstaged, staged] = await Promise.all([
			run(cwd, ["diff", "--no-ext-diff", "--numstat", "-z"], true),
			run(cwd, ["diff", "--no-ext-diff", "--cached", "--numstat", "-z"], true),
		]);
		const counts = parseNumstat(unstaged.stdout);
		for (const [path, value] of parseNumstat(staged.stdout)) {
			const current = counts.get(path) ?? { insertions: 0, deletions: 0 };
			counts.set(path, { insertions: current.insertions + value.insertions, deletions: current.deletions + value.deletions });
		}
		const files = [...new Set(entries)].map(path => ({ path, insertions: counts.get(path)?.insertions ?? 0, deletions: counts.get(path)?.deletions ?? 0 }));
		const insertions = files.reduce((sum, file) => sum + file.insertions, 0);
		const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
		return {
			branch: header.branch,
			hasWorkingTreeChanges: files.length > 0,
			workingTree: { files, insertions, deletions },
			hasUpstream: header.upstream !== null,
			upstreamBranch: header.upstream,
			aheadCount: header.ahead,
			behindCount: header.behind,
			pr: null,
		};
	}

	async function listBranches(input: Record<string, unknown>): Promise<GitListBranchesResult> {
		const cwd = validateCwd(input.cwd);
		const probe = await run(cwd, ["rev-parse", "--git-dir"], true);
		if (probe.stderr.includes("not a git repository") || !probe.stdout.trim()) return { branches: [], isRepo: false, hasOriginRemote: false };
		if (probe.failed) throw new Error(probe.stderr.trim() || "Unable to inspect Git repository");
		const [branchesOutput, origin, defaultRef, worktreeOutput, current] = await Promise.all([
			run(cwd, ["branch", "--all", "--no-color", "--format=%(refname)%09%(HEAD)%09%(upstream:short)"]),
			run(cwd, ["remote", "get-url", "origin"], true),
			run(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], true),
			run(cwd, ["worktree", "list", "--porcelain"], true),
			run(cwd, ["branch", "--show-current"], true),
		]);
		const defaultName = defaultBranchName(defaultRef.stdout) ?? (branchesOutput.stdout.split(/\r?\n/).some(line => line.startsWith("refs/heads/main\t")) ? "main" : branchesOutput.stdout.split(/\r?\n/).some(line => line.startsWith("refs/heads/master\t")) ? "master" : null);
		const worktrees = parseWorktrees(worktreeOutput.stdout);
		const branches = branchesOutput.stdout.split(/\r?\n/).flatMap(line => {
			if (!line.trim()) return [];
			const [rawName, head] = line.split("\t");
			if (!rawName) return [];
			const isRemote = rawName.startsWith("refs/remotes/");
			const isLocal = rawName.startsWith("refs/heads/");
			if (!isRemote && !isLocal) return [];
			const name = isRemote ? rawName.slice("refs/remotes/".length) : rawName.slice("refs/heads/".length);
			if (isRemote && name.endsWith("/HEAD")) return [];
			const remoteName = isRemote ? name.split("/", 1)[0] : undefined;
			const localName = isRemote && remoteName ? name.slice(remoteName.length + 1) : name;
			return [{ name, ...(isRemote ? { isRemote: true, remoteName } : {}), current: !isRemote && (head?.trim() === "*" || current.stdout.trim() === name), isDefault: localName === defaultName, worktreePath: !isRemote ? (worktrees.get(name) ?? null) : null }];
		});
		return { branches, isRepo: true, hasOriginRemote: Boolean(origin.stdout.trim()) };
	}

	async function listRecentCommits(input: Record<string, unknown>): Promise<GitListRecentCommitsResult> {
		const cwd = validateCwd(input.cwd);
		const limitValue = input.limit === undefined ? 20 : input.limit;
		if (!Number.isSafeInteger(limitValue) || (limitValue as number) < 1 || (limitValue as number) > 50) throw new Error("Invalid Git commit limit");
		const result = await run(cwd, ["log", `-${String(limitValue)}`, "--date=iso-strict", "--format=%H%x09%h%x09%cI%x09%s"]);
		const commits = result.stdout.split(/\r?\n/).flatMap(line => {
			if (!line) return [];
			const fields = line.split("\t");
			if (fields.length < 4 || !fields[0] || !fields[1] || !fields[2]) return [];
			return [{ sha: fields[0], shortSha: fields[1], committedAt: fields[2], subject: fields.slice(3).join("\t") }];
		});
		return { commits };
	}

	async function resolveDiffBase(cwd: string, input: Record<string, unknown>): Promise<string | null> {
		if (input.scope === "ref") return validateRevision(input.compareRef, "compareRef");
		if (input.scope !== "branch") return null;
		if (input.compareRef !== undefined) return validateRevision(input.compareRef, "compareRef");
		const upstream = await run(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], true);
		if (upstream.stdout.trim()) return validateRevision(upstream.stdout.trim(), "compareRef");
		const defaultRef = await run(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], true);
		if (defaultRef.stdout.trim()) return validateRevision(defaultRef.stdout.trim(), "compareRef");
		return null;
	}

	async function diffArgs(input: Record<string, unknown>, numstat: boolean): Promise<{ cwd: string; args: string[] }> {
		const cwd = validateCwd(input.cwd);
		const scope = input.scope === undefined ? "workingTree" : text(input.scope, "scope", 32);
		if (!["workingTree", "unstaged", "staged", "branch", "ref"].includes(scope)) throw new Error("Invalid Git diff scope");
		const filePath = input.filePath === undefined ? undefined : validatePath(input.filePath);
		const args = [...(filePath ? ["--literal-pathspecs"] : []), "diff", "--no-ext-diff", "--no-color", ...(numstat ? ["--numstat"] : ["--binary"])];
		if (scope === "staged") args.push("--cached");
		if (scope === "workingTree") args.push("HEAD");
		if (scope === "branch" || scope === "ref") {
			const base = await resolveDiffBase(cwd, { ...input, scope });
			if (!base) return { cwd, args: [...args, "--", ...(filePath ? [filePath] : [])] };
			args.push(`${base}...HEAD`);
		}
		args.push("--");
		if (filePath) args.push(filePath);
		return { cwd, args };
	}

	async function readDiff(input: Record<string, unknown>): Promise<GitReadWorkingTreeDiffResult> {
		const { cwd, args } = await diffArgs(input, false);
		const result = await run(cwd, args);
		return { patch: result.stdout, truncated: result.truncated };
	}

	async function readFileAtRev(input: Record<string, unknown>): Promise<GitReadFileAtRevResult> {
		const cwd = validateCwd(input.cwd);
		const filePath = validatePath(input.filePath);
		const maxBytesValue = input.maxBytes === undefined ? 1_000_000 : input.maxBytes;
		if (!Number.isSafeInteger(maxBytesValue) || (maxBytesValue as number) < 1 || (maxBytesValue as number) > 1_000_000) throw new Error("Invalid Git file size limit");
		const base = input.base === undefined ? undefined : text(input.base, "base", 32);
		if (base !== undefined && base !== "branch" && base !== "index") throw new Error("Invalid Git file base");
		let resolvedRev: string;
		if (input.rev !== undefined) {
			resolvedRev = validateRevision(input.rev, "revision");
		} else if (base === "index") {
			resolvedRev = ":0";
		} else if (base === "branch") {
			resolvedRev = (await resolveDiffBase(cwd, { scope: "branch" })) ?? "HEAD";
		} else {
			resolvedRev = "HEAD";
		}
		const result = await run(cwd, ["--literal-pathspecs", "show", `${resolvedRev}:${filePath}`], true, maxBytesValue as number);
		if (result.truncated) return { contents: result.stdout.slice(0, maxBytesValue as number), resolvedRev, missing: false, truncated: true };
		if (result.failed) {
			const detail = result.stderr.trim();
			if (/does not exist|exists on disk, but not in|path .* does not exist/i.test(detail)) return { contents: "", resolvedRev, missing: true, truncated: false };
			throw new Error(detail || "Unable to read Git file revision");
		}
		return { contents: result.stdout, resolvedRev, missing: false, truncated: false };
	}

	async function diffStats(input: Record<string, unknown>): Promise<GitWorkingTreeDiffStatsResult> {
		const { cwd, args } = await diffArgs(input, true);
		const result = await run(cwd, args);
		const counts = parseNumstat(result.stdout);
		let additions = 0;
		let deletions = 0;
		for (const value of counts.values()) { additions += value.insertions; deletions += value.deletions; }
		return { additions, deletions, fileCount: counts.size };
	}

	async function ensureClean(cwd: string): Promise<void> {
		const current = await status({ cwd });
		if (current.hasWorkingTreeChanges) throw new Error("Cannot checkout with uncommitted changes; stash or commit them first.");
	}

	async function checkout(input: Record<string, unknown>): Promise<void> {
		const cwd = validateCwd(input.cwd);
		const branch = validateBranch(input.branch);
		await ensureClean(cwd);
		// A remote row such as `origin/feature` must become a local tracking
		// branch.  Plain `git checkout origin/feature` leaves the worktree in a
		// detached HEAD, which makes the Environment branch picker misleading.
		const local = await run(cwd, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], true);
		if (!local.failed) {
			await run(cwd, ["checkout", "--quiet", branch]);
			return;
		}
		const remote = await run(cwd, ["show-ref", "--verify", "--quiet", `refs/remotes/${branch}`], true);
		if (remote.failed) {
			await run(cwd, ["checkout", "--quiet", branch]);
			return;
		}
		const remoteParts = branch.split("/");
		const localName = remoteParts.length > 1 ? remoteParts.slice(1).join("/") : branch;
		const localCounterpart = await run(cwd, ["show-ref", "--verify", "--quiet", `refs/heads/${localName}`], true);
		await run(cwd, localCounterpart.failed
			? ["checkout", "--quiet", "--track", branch]
			: ["checkout", "--quiet", localName]);
	}

	async function createBranch(input: Record<string, unknown>): Promise<void> {
		const cwd = validateCwd(input.cwd);
		const branch = validateBranch(input.branch);
		await run(cwd, ["branch", "--", branch]);
		if (input.publish === true) await run(cwd, ["push", "--set-upstream", "origin", branch]);
	}

	async function runAction(event: unknown, input: Record<string, unknown>): Promise<GitRunStackedActionResult> {
		const sender = senderFromEvent(event);
		const actionId = text(input.actionId, "action id", 128);
		const cwd = validateCwd(input.cwd);
		if (!isGitAction(input.action)) throw new Error("Invalid Git action");
		const action = input.action;
		if (action === "create_pr" || action === "commit_push_pr") throw new Error("GitHub pull request actions are unavailable in Cedia");
		if (input.featureBranch !== undefined && typeof input.featureBranch !== "boolean") throw new Error("Invalid Git featureBranch flag");
		const paths = actionFilePaths(input.filePaths);
		const message = actionCommitMessage(input.commitMessage);
		const emit = (payload: Record<string, unknown>) => {
			if (sender.isDestroyed?.()) return;
			try { sender.send(CEDIA_AGENT_GIT_EVENT_CHANNEL, { actionId, cwd, action, ...payload }); } catch { /* renderer closed */ }
		};
		let branch = (await status({ cwd })).branch;
		if (!branch) throw new Error("Git action requires a checked out branch");
		const wantsFeatureBranch = input.featureBranch === true;
		let branchStatus: GitRunStackedActionResult["branch"] = { status: "skipped_not_requested" };
		emit({ kind: "action_started", phases: actionPhases(action, wantsFeatureBranch) });
		let commitStatus: GitRunStackedActionResult["commit"] = { status: "skipped_not_requested" };
		let pushStatus: GitRunStackedActionResult["push"] = { status: "skipped_not_requested" };
		try {
			if (wantsFeatureBranch) {
				emit({ kind: "phase_started", phase: "branch", label: "Preparing feature branch" });
				const branches = await listBranches({ cwd });
				const nextBranch = uniqueFeatureBranchName(branches.branches);
				// Unlike the user-facing checkout API, a stacked "new branch" action
				// intentionally carries the user's dirty files onto the new branch.
				await run(cwd, ["checkout", "--quiet", "-b", nextBranch]);
				branch = nextBranch;
				branchStatus = { status: "created", name: nextBranch };
			}
			if (action === "commit" || action === "commit_push") {
				emit({ kind: "phase_started", phase: "commit", label: "Commit" });
				// The dialog sends null/omits filePaths when all changed files are
				// selected. Stage that workspace explicitly so an unstaged edit is not
				// silently reported as a successful no-op.
				if (paths === null) await run(cwd, ["add", "-A", "--", "."]);
				else await run(cwd, ["--literal-pathspecs", "add", "--", ...paths]);
				const stagedNames = await run(cwd, [...(paths ? ["--literal-pathspecs"] : []), "diff", "--cached", "--name-only", ...(paths ? ["--", ...paths] : [])]);
				if (!stagedNames.stdout.trim()) {
					commitStatus = { status: "skipped_no_changes" };
				} else {
					const commitArgs = [...(paths ? ["--literal-pathspecs"] : []), "commit", "-m", message, ...(paths ? ["--only", "--", ...paths] : [])];
					await run(cwd, commitArgs);
					const sha = (await run(cwd, ["rev-parse", "HEAD"])).stdout.trim();
					commitStatus = { status: "created", ...(sha ? { commitSha: sha } : {}), subject: message };
				}
			}
			if (action === "push" || action === "commit_push") {
				emit({ kind: "phase_started", phase: "push", label: "Push" });
				const current = await status({ cwd });
				if (current.behindCount > 0) throw new Error("Branch is behind upstream; pull or rebase before pushing.");
				if (current.aheadCount === 0 && current.hasUpstream) pushStatus = { status: "skipped_up_to_date", branch, ...(current.upstreamBranch ? { upstreamBranch: current.upstreamBranch } : {}) };
				else {
					if (!current.hasUpstream) {
						const origin = await run(cwd, ["remote", "get-url", "origin"], true);
						if (origin.failed || !origin.stdout.trim()) throw new Error("Cannot push without an origin remote.");
					}
					const args = current.hasUpstream ? ["push"] : ["push", "--set-upstream", "origin", branch];
					await run(cwd, args);
					pushStatus = { status: "pushed", branch, ...(current.upstreamBranch ? { upstreamBranch: current.upstreamBranch } : {}), ...(current.hasUpstream ? {} : { setUpstream: true }) };
				}
			}
			const result: GitRunStackedActionResult = { action, branch: branchStatus, commit: commitStatus, push: pushStatus, pr: { status: "skipped_not_requested" } };
			emit({ kind: "action_finished", result });
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			emit({ kind: "action_failed", phase: null, message });
			throw error;
		}
	}

	return {
		handle: async (event: unknown, method: string, rawInput: unknown): Promise<unknown> => {
			if (disposed) throw new Error("Git service is disposed");
			const input = record(rawInput);
			switch (method) {
			case "status": return status(input);
			case "listBranches": return listBranches(input);
			case "listRecentCommits": return listRecentCommits(input);
			case "readWorkingTreeDiff": return readDiff(input);
			case "readFileAtRev": return readFileAtRev(input);
				case "workingTreeDiffStats": return diffStats(input);
				case "createBranch": return createBranch(input);
				case "checkout": return checkout(input);
				case "runStackedAction": return runAction(event, input);
				default: throw new Error(`Unsupported Git method '${method}'`);
			}
		},
		dispose: () => { disposed = true; },
	};
}
