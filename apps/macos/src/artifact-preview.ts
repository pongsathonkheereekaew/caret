/** D12 / S12 artifact preview classification. MIME-aware viewers only.
 * Unknown and non-previewable types stay download-only. Caret never invents execute. */

export type ArtifactPreviewKind = "image" | "audio" | "video" | "pdf" | "text" | "binary" | "unknown";
export type ArtifactPreviewViewer = "inline" | "download";

export interface ArtifactPreviewInput {
	readonly mime?: string;
	readonly name?: string;
	readonly sha256?: string;
	readonly size?: number;
	readonly buildId?: string;
}

export interface ArtifactPreview {
	readonly kind: ArtifactPreviewKind;
	readonly viewer: ArtifactPreviewViewer;
	readonly reason?: string;
	readonly header: string;
}

export const UNKNOWN_MIME_REASON =
	"Unknown MIME is download only. Caret will not execute this file.";

export const NO_AUTOPLAY_REASON = "no autoplay";

const INLINE_KINDS = new Set<ArtifactPreviewKind>(["image", "audio", "video", "pdf", "text"]);

const EXTENSION_KIND: Readonly<Record<string, ArtifactPreviewKind>> = {
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
	webp: "image",
	svg: "image",
	bmp: "image",
	ico: "image",
	avif: "image",
	tif: "image",
	tiff: "image",
	mp3: "audio",
	wav: "audio",
	ogg: "audio",
	m4a: "audio",
	aac: "audio",
	flac: "audio",
	opus: "audio",
	oga: "audio",
	mp4: "video",
	webm: "video",
	mov: "video",
	mkv: "video",
	ogv: "video",
	m4v: "video",
	pdf: "pdf",
	txt: "text",
	md: "text",
	markdown: "text",
	json: "text",
	csv: "text",
	tsv: "text",
	xml: "text",
	yaml: "text",
	yml: "text",
	log: "text",
	html: "text",
	htm: "text",
	css: "text",
	js: "text",
	ts: "text",
	tsx: "text",
	jsx: "text",
	exe: "binary",
	bin: "binary",
	dll: "binary",
	so: "binary",
	dylib: "binary",
	wasm: "binary",
	zip: "binary",
	gz: "binary",
	dmg: "binary",
	pkg: "binary",
	sh: "binary",
	bat: "binary",
	command: "binary",
	msi: "binary",
};

export function classifyArtifactPreview(input: ArtifactPreviewInput): ArtifactPreview {
	const mime = normalizeMime(input.mime);
	const fromMime = kindFromMime(mime);
	const kind = fromMime ?? kindFromExtension(input.name) ?? "unknown";
	const viewer: ArtifactPreviewViewer = INLINE_KINDS.has(kind) ? "inline" : "download";
	const reason = previewReason(kind);
	return {
		kind,
		viewer,
		...(reason ? { reason } : {}),
		header: previewHeader(input),
	};
}

/** Keep a good inline preview when the incoming build is failed/unknown.
 * Incoming stays marked download-only; it does not replace last-good. */
export function retainLastGoodPreview(
	current: ArtifactPreview | undefined,
	incoming: ArtifactPreview,
): ArtifactPreview {
	if (current && isGoodInlinePreview(current) && isFailedOrUnknownPreview(incoming)) {
		return current;
	}
	return incoming;
}

export interface ArtifactPreviewItem {
	readonly name: string;
	readonly sha256: string;
	readonly size: number;
	readonly mime?: string;
	readonly buildId?: string;
}

export type ArtifactPreviewView<T extends ArtifactPreviewItem = ArtifactPreviewItem> = T & {
	readonly preview: ArtifactPreview;
	readonly incomingPreview: ArtifactPreview;
	readonly retainedLastGood: boolean;
};

export const INLINE_PREVIEW_MAX_BYTES = 256 * 1024;

const RASTER_EXT_MIME: Readonly<Record<string, string>> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	ico: "image/x-icon",
	avif: "image/avif",
	tif: "image/tiff",
	tiff: "image/tiff",
};

export function inlinePreviewMime(kind: ArtifactPreviewKind, input?: Pick<ArtifactPreviewInput, "mime" | "name">): string | undefined {
	if (isSvgLike(input)) return undefined;
	if (kind === "image") {
		const normalized = normalizeMime(input?.mime);
		if (normalized.startsWith("image/") && normalized !== "image/svg+xml") return normalized;
		return RASTER_EXT_MIME[fileExtension(input?.name)];
	}
	if (kind === "text") return "text/plain;charset=utf-8";
	return undefined;
}

export function canInlinePreviewBytes(
	kind: ArtifactPreviewKind,
	size: number,
	input?: Pick<ArtifactPreviewInput, "mime" | "name">,
): boolean {
	if (!Number.isFinite(size) || size < 0 || size > INLINE_PREVIEW_MAX_BYTES) return false;
	return Boolean(inlinePreviewMime(kind, input));
}

function isSvgLike(input?: Pick<ArtifactPreviewInput, "mime" | "name">): boolean {
	const mime = normalizeMime(input?.mime);
	if (mime === "image/svg+xml" || mime.endsWith("+xml") && mime.includes("svg")) return true;
	return fileExtension(input?.name) === "svg";
}

export function mapArtifactsForWebview<T extends ArtifactPreviewItem>(
	items: readonly T[],
	lastGoodByName: Readonly<Record<string, ArtifactPreview>>,
): { readonly artifacts: ArtifactPreviewView<T>[]; readonly lastGoodByName: Record<string, ArtifactPreview> } {
	const nextLastGood: Record<string, ArtifactPreview> = { ...lastGoodByName };
	const artifacts = items.map((item) => {
		const incoming = classifyArtifactPreview(item);
		const preview = retainLastGoodPreview(nextLastGood[item.name], incoming);
		if (isGoodInlinePreview(preview)) nextLastGood[item.name] = preview;
		return {
			...item,
			preview,
			incomingPreview: incoming,
			retainedLastGood: preview !== incoming,
		};
	});
	return { artifacts, lastGoodByName: nextLastGood };
}

function previewReason(kind: ArtifactPreviewKind): string | undefined {
	if (kind === "audio" || kind === "video") return NO_AUTOPLAY_REASON;
	if (kind === "unknown" || kind === "binary") return UNKNOWN_MIME_REASON;
	return undefined;
}

function isGoodInlinePreview(preview: ArtifactPreview): boolean {
	return preview.viewer === "inline" && INLINE_KINDS.has(preview.kind);
}

function isFailedOrUnknownPreview(preview: ArtifactPreview): boolean {
	return preview.kind === "unknown" || preview.reason === UNKNOWN_MIME_REASON;
}

function kindFromMime(mime: string): ArtifactPreviewKind | undefined {
	if (!mime || mime === "unknown" || mime === "failed") return undefined;
	const slash = mime.indexOf("/");
	if (slash <= 0 || slash === mime.length - 1) return undefined;
	const type = mime.slice(0, slash);
	if (type === "image") return "image";
	if (type === "audio") return "audio";
	if (type === "video") return "video";
	if (mime === "application/pdf") return "pdf";
	if (type === "text" || mime === "application/json" || mime.endsWith("+json")) return "text";
	return "binary";
}

function kindFromExtension(name: string | undefined): ArtifactPreviewKind | undefined {
	const ext = fileExtension(name);
	if (!ext) return undefined;
	return EXTENSION_KIND[ext];
}

function fileExtension(name: string | undefined): string {
	if (!name) return "";
	const base = name.split(/[/\\]/).pop() ?? "";
	const dot = base.lastIndexOf(".");
	if (dot <= 0 || dot === base.length - 1) return "";
	return base.slice(dot + 1).toLowerCase();
}

function normalizeMime(mime: string | undefined): string {
	return (mime ?? "").trim().toLowerCase().split(";")[0]!.trim();
}

function previewHeader(input: ArtifactPreviewInput): string {
	const parts: string[] = [];
	const name = input.name?.trim();
	if (name) parts.push(name);
	const mime = input.mime?.trim();
	if (mime) parts.push(mime);
	if (typeof input.size === "number" && Number.isFinite(input.size)) {
		parts.push(`${input.size} bytes`);
	}
	const hash = input.sha256?.trim();
	if (hash) parts.push(hash.slice(0, 12));
	const buildId = input.buildId?.trim();
	if (buildId) parts.push(buildId);
	return parts.join(" · ");
}
