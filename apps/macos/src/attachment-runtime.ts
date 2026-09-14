export type AttachmentState = "local" | "uploading" | "ready" | "failed";

export interface Attachment {
	readonly id: string;
	readonly name: string;
	readonly mime: string;
	readonly bytes?: number;
	readonly contentRef?: string;
	readonly uploadedBytes?: number;
	readonly state: AttachmentState;
	readonly error?: string;
}

export type AttachmentAction =
	| { readonly type: "start_upload" }
	| { readonly type: "progress"; readonly uploadedBytes?: number }
	| { readonly type: "ready"; readonly contentRef: string }
	| { readonly type: "fail"; readonly error: string }
	| { readonly type: "retry" }
	| { readonly type: "remove" };

export const UNKNOWN_UPLOAD_LIMIT_REASON =
	"Host upload size limit is unavailable. Refresh capabilities.";

export function evaluateUploadLimit(
	bytes: number | undefined,
	advertisedMaxBytes: number | null | undefined,
): { readonly allowed: true } | { readonly allowed: false; readonly reason: string } {
	if (advertisedMaxBytes == null || !Number.isFinite(advertisedMaxBytes) || advertisedMaxBytes < 0) {
		return { allowed: false, reason: UNKNOWN_UPLOAD_LIMIT_REASON };
	}
	if (typeof bytes === "number" && Number.isFinite(bytes) && bytes > advertisedMaxBytes) {
		return { allowed: false, reason: `File exceeds advertised upload limit of ${advertisedMaxBytes} bytes.` };
	}
	return { allowed: true };
}

export function reduceAttachment(a: Attachment, action: AttachmentAction): Attachment {
	switch (action.type) {
		case "start_upload":
			return beginUpload(a);
		case "progress":
			if (a.state !== "uploading") return a;
			return {
				...a,
				state: "uploading",
				error: undefined,
				uploadedBytes: action.uploadedBytes ?? a.uploadedBytes,
			};
		case "ready": {
			const contentRef = action.contentRef.trim();
			if (!contentRef) {
				return failAttachment(a, "Ready attachments require an immutable contentRef (hash).");
			}
			if (a.state === "ready" && a.contentRef && a.contentRef !== contentRef) {
				return a;
			}
			return {
				...a,
				state: "ready",
				contentRef,
				error: undefined,
			};
		}
		case "fail":
			return failAttachment(a, action.error);
		case "retry":
			if (a.state !== "failed") return a;
			return beginUpload(a);
		case "remove":
			return a;
	}
}

export function alreadyAttached(
	attachments: readonly Attachment[],
	candidate: { readonly name?: string; readonly contentRef?: string },
): boolean {
	const name = candidate.name?.trim();
	const ref = candidate.contentRef?.trim();
	return attachments.some((item) => {
		if (ref && item.contentRef && item.contentRef === ref) return true;
		return Boolean(name) && item.name === name;
	});
}

export function dispatchBlocked(attachments: readonly Attachment[]): boolean {
	return attachments.some((item) => item.state !== "ready" || !item.contentRef);
}

export function readyRefs(attachments: readonly Attachment[]): string[] {
	return attachments
		.filter((item) => item.state === "ready" && Boolean(item.contentRef))
		.map((item) => item.contentRef as string);
}

function beginUpload(a: Attachment): Attachment {
	if (a.state === "ready" && a.contentRef) return a;
	return {
		...a,
		state: "uploading",
		error: undefined,
		contentRef: undefined,
		id: a.id,
	};
}

function failAttachment(a: Attachment, error: string): Attachment {
	if (a.state === "ready" && a.contentRef) return a;
	return {
		...a,
		state: "failed",
		error,
		id: a.id,
	};
}
