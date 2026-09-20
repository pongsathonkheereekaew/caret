/** Task-scoped Git review projection (S08). Parses `git status --porcelain`.
 * Does not stage, commit, or invent a second review owner. */

export type ReviewFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflict" | "unknown";

export interface ReviewFile {
	readonly path: string;
	readonly status: ReviewFileStatus;
	readonly tracked: boolean;
	readonly staged: boolean;
	readonly unstaged: boolean;
	readonly binaryHint: boolean;
}

export interface ReviewHunk {
	readonly header: string;
	readonly lines: readonly string[];
}

export interface ReviewSnapshot {
	readonly cwd: string;
	readonly files: readonly ReviewFile[];
	readonly selectedPath?: string;
	readonly hunks?: readonly ReviewHunk[];
	readonly diffError?: string;
	readonly error?: string;
	readonly stale: boolean;
	readonly staleReason?: string;
	readonly noGit?: boolean;
	readonly dirtyConflict?: boolean;
	readonly dirtyConflictReason?: string;
	readonly dirtyPaths?: readonly string[];
}

export interface ReviewSummary {
	readonly total: number;
	readonly modified: number;
	readonly added: number;
	readonly deleted: number;
	readonly renamed: number;
	readonly untracked: number;
	readonly conflict: number;
	readonly binary: number;
	readonly plus: number;
	readonly minus: number;
}

/** D08 stale-diff banner. English is required; Thai is the design-spec primary. */
export const REVIEW_STALE_REASON = "ไฟล์เปลี่ยนแล้ว — โหลด diff ใหม่. The file changed — reload the diff. Cedia will not apply a stale hunk.";
export const REVIEW_NO_GIT_REASON = "This folder is not a Git repository. Git setup is an explicit choice. Cedia does not initialize a repository from this panel.";
export const REVIEW_NO_PROPOSAL_REASON = "No advertised agent proposals for this folder. Cedia does not invent hunks outside Git or OMP.";
export const REVIEW_DIRTY_REASON = "ไฟล์มีการแก้ไขใหม่ ยังไม่ได้นำข้อเสนอไปใช้. The file has unsaved edits. Cedia will not apply a proposal over a dirty buffer.";

export function isNonGitStatusError(error: string | undefined): boolean {
	const text = (error ?? "").toLowerCase();
	return text.includes("not a git repository") || text.includes("not a git repo");
}

const BINARY_EXT = /\.(png|jpe?g|gif|webp|pdf|zip|gz|woff2?|mp3|mp4|mov|wasm|ico|icns|dylib|so|exe|bin)$/i;

export function emptyReview(cwd = ""): ReviewSnapshot {
	return { cwd, files: [], stale: false };
}

export function parsePorcelainStatus(stdout: string): ReviewFile[] {
	const files: ReviewFile[] = [];
	for (const raw of stdout.split(/\r?\n/)) {
		if (!raw) continue;
		if (raw.startsWith("warning:") || raw.startsWith("#")) continue;
		const parsed = parsePorcelainLine(raw);
		if (parsed) files.push(parsed);
	}
	return files;
}

export function reviewFromGitStatus(stdout: string, cwd: string, error?: string): ReviewSnapshot {
	if (error) {
		const noGit = isNonGitStatusError(error);
		return { cwd, files: [], error: noGit ? REVIEW_NO_GIT_REASON : error, stale: false, noGit };
	}
	return { cwd, files: parsePorcelainStatus(stdout), stale: false };
}

function parsePorcelainLine(line: string): ReviewFile | undefined {
	if (line.startsWith("?? ")) {
		const path = line.slice(3).trim();
		return path ? file(path, "untracked", false, false, false) : undefined;
	}
	if (line.startsWith("UU ") || line.startsWith("AA ") || line.startsWith("DD ") || line.startsWith("AU ") || line.startsWith("UA ") || line.startsWith("DU ") || line.startsWith("UD ")) {
		const path = line.slice(3).trim();
		return path ? file(path, "conflict", true, true, true) : undefined;
	}
	if (line.length < 4) return undefined;
	const index = line[0];
	const work = line[1];
	const rest = line.slice(3);
	const path = renamePath(rest);
	if (!path) return undefined;
	const staged = index !== " " && index !== "?";
	const unstaged = work !== " " && work !== "?";
	return file(path, statusFrom(index, work), true, staged, unstaged);
}

function renamePath(rest: string): string {
	const arrow = rest.indexOf(" -> ");
	return (arrow >= 0 ? rest.slice(arrow + 4) : rest).trim();
}

function statusFrom(index: string, work: string): ReviewFileStatus {
	const mark = work !== " " && work !== "?" ? work : index;
	if (mark === "A") return "added";
	if (mark === "D") return "deleted";
	if (mark === "R" || mark === "C") return "renamed";
	if (mark === "M" || mark === "T") return "modified";
	if (mark === "U") return "conflict";
	return "unknown";
}

function file(path: string, status: ReviewFileStatus, tracked: boolean, staged: boolean, unstaged: boolean): ReviewFile {
	return { path, status, tracked, staged, unstaged, binaryHint: BINARY_EXT.test(path) };
}

/** D08 wide review: split unified hunk lines into left/right columns. */
export function splitHunkColumns(lines: readonly string[]): { readonly left: readonly string[]; readonly right: readonly string[] } {
	const left: string[] = [];
	const right: string[] = [];
	for (const line of lines) {
		if (line.startsWith("+") && !line.startsWith("+++")) {
			left.push(" ");
			right.push(line);
		} else if (line.startsWith("-") && !line.startsWith("---")) {
			left.push(line);
			right.push(" ");
		} else {
			left.push(line);
			right.push(line);
		}
	}
	return { left, right };
}

export function parseUnifiedDiff(stdout: string): ReviewHunk[] {
	const hunks: ReviewHunk[] = [];
	let current: { header: string; lines: string[] } | undefined;
	for (const raw of stdout.split(/\r?\n/)) {
		if (raw.startsWith("diff --git ") || raw.startsWith("index ") || raw.startsWith("--- ") || raw.startsWith("+++ ")) continue;
		if (raw.startsWith("@@")) {
			if (current) hunks.push(current);
			current = { header: raw, lines: [] };
			continue;
		}
		if (current && (raw.startsWith("+") || raw.startsWith("-") || raw.startsWith(" ") || raw.startsWith("\\"))) {
			if (current.lines.length < 80) current.lines.push(raw);
		}
	}
	if (current) hunks.push(current);
	return hunks;
}

export function reviewPlusMinus(hunks: readonly ReviewHunk[]): { plus: number; minus: number } {
	let plus = 0;
	let minus = 0;
	for (const hunk of hunks) {
		for (const line of hunk.lines) {
			if (line.startsWith("@@") || line.startsWith("\\")) continue;
			if (line.startsWith("+") && !line.startsWith("+++")) plus += 1;
			else if (line.startsWith("-") && !line.startsWith("---")) minus += 1;
		}
	}
	return { plus, minus };
}

export function reviewSummary(files: readonly ReviewFile[], hunks?: readonly ReviewHunk[]): ReviewSummary {
	let modified = 0;
	let added = 0;
	let deleted = 0;
	let renamed = 0;
	let untracked = 0;
	let conflict = 0;
	let binary = 0;
	for (const item of files) {
		if (item.status === "modified") modified += 1;
		else if (item.status === "added") added += 1;
		else if (item.status === "deleted") deleted += 1;
		else if (item.status === "renamed") renamed += 1;
		else if (item.status === "untracked") untracked += 1;
		else if (item.status === "conflict") conflict += 1;
		if (item.binaryHint) binary += 1;
	}
	const delta = hunks ? reviewPlusMinus(hunks) : { plus: 0, minus: 0 };
	return { total: files.length, modified, added, deleted, renamed, untracked, conflict, binary, plus: delta.plus, minus: delta.minus };
}

export function markReviewStale(snapshot: ReviewSnapshot, reason?: string): ReviewSnapshot {
	return { ...snapshot, stale: true, staleReason: reason ?? REVIEW_STALE_REASON };
}

export function overlapReviewDirty(reviewPaths: readonly string[], dirtyPaths: readonly string[]): string[] {
	const dirty = new Set(dirtyPaths.map(pathTail));
	return reviewPaths.filter((path) => dirty.has(pathTail(path)));
}

export function markReviewDirtyConflict(snapshot: ReviewSnapshot, dirtyPaths: readonly string[]): ReviewSnapshot {
	const overlap = overlapReviewDirty(snapshot.files.map((file) => file.path), dirtyPaths);
	if (!overlap.length) {
		return { ...snapshot, dirtyConflict: false, dirtyPaths: [], dirtyConflictReason: undefined };
	}
	return {
		...snapshot,
		dirtyConflict: true,
		dirtyPaths: overlap,
		dirtyConflictReason: REVIEW_DIRTY_REASON,
	};
}

function pathTail(path: string): string {
	return path.replace(/\\/g, "/").replace(/^.*\//, "").toLowerCase();
}

export function reviewWorkspaceLabel(cwd: string, branch?: string): string {
	return branch ? `${branch} · ${cwd}` : `Folder · ${cwd}`;
}

export const COMMIT_NO_CONTRACT_REASON =
	"Commit stays in Code-OSS until OMP advertises a task-scoped commit contract. Cedia will not auto-push.";
export const COMMIT_AND_PUSH_REASON =
	"Commit and Push is a separate explicit action. No remote destination is advertised.";
export const REVIEW_CONFLICT_REASON =
	"Conflict. Cedia will not merge. Open the Code-OSS merge editor if Git advertised one.";
export const REVIEW_BRING_BACK_REASON =
	"OMP has not advertised a checkpoint to restore. Cedia will not invent a bring-back.";

export function reviewConflictMark(status: ReviewFileStatus): string {
	if (status === "untracked") return "?";
	if (status === "conflict") return "U";
	if (status === "added") return "A";
	if (status === "deleted") return "D";
	if (status === "renamed") return "R";
	return "M";
}

export function reviewOpenMergeEnabled(file?: Pick<ReviewFile, "status">): boolean {
	return file?.status === "conflict";
}

export function reviewBringBackPreview(): { readonly enabled: false; readonly reason: typeof REVIEW_BRING_BACK_REASON } {
	return { enabled: false, reason: REVIEW_BRING_BACK_REASON };
}

export interface ReviewCommitPreview {
	readonly branch: string;
	readonly staged: number;
	readonly unstaged: number;
	readonly message: string;
	readonly commitEnabled: false;
	readonly pushEnabled: false;
	readonly commitReason: string;
	readonly pushReason: string;
	readonly emptyMessage: boolean;
}

export function reviewCommitPreview(input: {
	readonly branch?: string;
	readonly files: readonly ReviewFile[];
	readonly message?: string;
}): ReviewCommitPreview {
	const staged = input.files.filter((file) => file.staged).length;
	const unstaged = input.files.filter((file) => file.unstaged || file.status === "untracked").length;
	const message = input.message?.trim() ?? "";
	return {
		branch: input.branch?.trim() || "Folder",
		staged,
		unstaged,
		message,
		commitEnabled: false,
		pushEnabled: false,
		commitReason: COMMIT_NO_CONTRACT_REASON,
		pushReason: COMMIT_AND_PUSH_REASON,
		emptyMessage: message.length === 0,
	};
}

/** D08 / CA-04: Open in IDE never lands on SCM welcome (Initialize Repository / Publish). */
export type IdeWorkLanding =
	| { readonly view: "file"; readonly path: string; readonly message?: string }
	| { readonly view: "explorer"; readonly message?: string }
	| { readonly view: "none"; readonly message?: string };

export function ideLandingForWorkTab(
	tab: string,
	review?: { readonly noGit?: boolean; readonly selectedPath?: string },
): IdeWorkLanding {
	if (tab === "files") return { view: "explorer" };
	if (tab !== "changes") return { view: "none" };
	const message = review?.noGit === true ? REVIEW_NO_GIT_REASON : undefined;
	const path = review?.selectedPath?.trim();
	if (path) return message ? { view: "file", path, message } : { view: "file", path };
	return message ? { view: "explorer", message } : { view: "explorer" };
}
