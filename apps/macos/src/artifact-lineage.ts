export interface ArtifactBuild {
	readonly buildId: string;
	readonly hash: string;
	readonly status?: string;
}

export interface MimeSafety {
	readonly preview: boolean;
	readonly downloadOnly: boolean;
}

const EXECUTABLE_OR_UNSAFE = new Set([
	"application/x-executable",
	"application/x-msdownload",
	"application/x-msdos-program",
	"application/x-mach-binary",
	"application/x-elf",
	"application/vnd.microsoft.portable-executable",
	"application/x-sh",
	"application/x-bat",
	"application/x-dosexec",
	"application/octet-stream",
]);

const PREVIEWABLE_TYPES = new Set([
	"application/pdf",
	"application/json",
	"image/svg+xml",
]);

export function retainLastGood<T extends { readonly status?: string }>(currentFailed: T, lastGood: T | null | undefined): T {
	if (isFailed(currentFailed) && lastGood != null && !isFailed(lastGood)) return lastGood;
	if (isFailed(currentFailed) && lastGood != null) return lastGood;
	return currentFailed;
}

export function sameBuild(a: ArtifactBuild, b: ArtifactBuild): boolean {
	return a.buildId === b.buildId && a.hash === b.hash && Boolean(a.buildId) && Boolean(a.hash);
}

export function unknownMimeSafe(mime: string | null | undefined): MimeSafety {
	const normalized = (mime ?? "").trim().toLowerCase();
	if (!normalized || normalized === "unknown" || EXECUTABLE_OR_UNSAFE.has(normalized)) {
		return { preview: false, downloadOnly: true };
	}
	const [type] = normalized.split("/");
	if (type === "image" || type === "audio" || type === "video" || type === "text" || PREVIEWABLE_TYPES.has(normalized)) {
		return { preview: true, downloadOnly: false };
	}
	return { preview: false, downloadOnly: true };
}

function isFailed(item: { readonly status?: string }): boolean {
	return item.status === "failed" || item.status === "error";
}
