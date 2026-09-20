import { describe, expect, it } from "bun:test";
import {
	UNKNOWN_UPLOAD_LIMIT_REASON,
	alreadyAttached,
	dispatchBlocked,
	evaluateUploadLimit,
	readyRefs,
	reduceAttachment,
	type Attachment,
} from "../src/attachment-runtime.ts";

const localFile: Attachment = {
	id: "att-1",
	name: "notes.txt",
	mime: "text/plain",
	bytes: 12,
	state: "local",
};

describe("attachment upload state machine", () => {
	it("moves local → uploading → ready and requires an immutable contentRef", () => {
		const uploading = reduceAttachment(localFile, { type: "start_upload" });
		expect(uploading.state).toBe("uploading");
		expect(uploading.id).toBe("att-1");
		expect(uploading.contentRef).toBeUndefined();

		const progressed = reduceAttachment(uploading, { type: "progress", uploadedBytes: 4 });
		expect(progressed.state).toBe("uploading");
		expect(progressed.uploadedBytes).toBe(4);

		const missingHash = reduceAttachment(uploading, { type: "ready", contentRef: "  " });
		expect(missingHash.state).toBe("failed");

		const ready = reduceAttachment(uploading, { type: "ready", contentRef: "sha256:abc" });
		expect(ready.state).toBe("ready");
		expect(ready.contentRef).toBe("sha256:abc");

		const mutated = reduceAttachment(ready, { type: "ready", contentRef: "sha256:other" });
		expect(mutated.contentRef).toBe("sha256:abc");
		expect(mutated.state).toBe("ready");
	});

	it("retries a failed upload with the same identity and supports conceptual Retry/Remove", () => {
		const failed = reduceAttachment(localFile, { type: "fail", error: "network" });
		expect(failed.state).toBe("failed");
		expect(failed.error).toBe("network");
		expect(failed.id).toBe("att-1");

		const retried = reduceAttachment(failed, { type: "retry" });
		expect(retried.state).toBe("uploading");
		expect(retried.id).toBe("att-1");
		expect(retried.name).toBe("notes.txt");
		expect(retried.error).toBeUndefined();

		const removed = reduceAttachment(failed, { type: "remove" });
		expect(removed.id).toBe("att-1");
		expect(removed).toBe(failed);
	});

	it("blocks dispatch while any attachment is pending or failed, and only yields ready hashes", () => {
		const uploading = reduceAttachment(localFile, { type: "start_upload" });
		const failed = reduceAttachment({ ...localFile, id: "att-2" }, { type: "fail", error: "denied" });
		const ready = reduceAttachment(uploading, { type: "ready", contentRef: "sha256:ready" });

		expect(dispatchBlocked([localFile])).toBe(true);
		expect(dispatchBlocked([uploading])).toBe(true);
		expect(dispatchBlocked([failed])).toBe(true);
		expect(dispatchBlocked([ready, failed])).toBe(true);
		expect(dispatchBlocked([ready])).toBe(false);
		expect(dispatchBlocked([])).toBe(false);

		expect(readyRefs([ready, failed, uploading])).toEqual(["sha256:ready"]);
		expect(readyRefs([{ ...ready, contentRef: undefined, state: "ready" }])).toEqual([]);
	});

	it("does not invent an unlimited size when the host limit is unknown", () => {
		expect(evaluateUploadLimit(12, undefined)).toEqual({
			allowed: false,
			reason: UNKNOWN_UPLOAD_LIMIT_REASON,
		});
		expect(evaluateUploadLimit(12, null)).toEqual({
			allowed: false,
			reason: UNKNOWN_UPLOAD_LIMIT_REASON,
		});
		expect(evaluateUploadLimit(100, 50).allowed).toBe(false);
		expect(evaluateUploadLimit(12, 1024)).toEqual({ allowed: true });
	});

	it("detects an already-attached name or contentRef without blocking a second explicit add", () => {
		const ready: Attachment = { id: "att-2", name: "notes.txt", mime: "text/plain", state: "ready", contentRef: "sha256:abc" };
		expect(alreadyAttached([ready], { name: "notes.txt" })).toBe(true);
		expect(alreadyAttached([ready], { contentRef: "sha256:abc" })).toBe(true);
		expect(alreadyAttached([ready], { name: "other.txt" })).toBe(false);
	});
});
