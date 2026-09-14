/** Map advertised OMP history rows onto transcript entries.
 * Does not invent messages or treat host event pages as going backward. */

import type { TranscriptEntry, TranscriptRole } from "./state.ts";

export function transcriptEntriesFromOmpMessages(messages: readonly unknown[]): TranscriptEntry[] {
	const entries: TranscriptEntry[] = [];
	for (const raw of messages) {
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
		const record = raw as Record<string, unknown>;
		const text = messageText(record);
		const id = firstString(record.id, record.messageId, record.message_id);
		if (!id && !text) continue;
		const role = messageRole(record.role);
		entries.push({
			id: `omp-hist:${id || slug(text)}`,
			kind: role === "tool" ? "tool" : "message",
			role,
			text,
			status: "completed",
			rawFrames: [record],
		});
	}
	return entries;
}

export function prependTranscriptEntries(
	current: readonly TranscriptEntry[],
	incoming: readonly TranscriptEntry[],
): TranscriptEntry[] {
	const seen = new Set(current.map(entry => entry.id));
	const prepend = incoming.filter(entry => entry.id && !seen.has(entry.id));
	return prepend.length ? [...prepend, ...current] : [...current];
}

function messageRole(value: unknown): TranscriptRole {
	if (value === "user" || value === "assistant" || value === "system" || value === "tool") return value;
	return "assistant";
}

function messageText(record: Record<string, unknown>): string {
	if (typeof record.text === "string" && record.text.trim()) return record.text;
	if (typeof record.content === "string" && record.content.trim()) return record.content;
	if (typeof record.message === "string" && record.message.trim()) return record.message;
	if (Array.isArray(record.content)) {
		return record.content
			.map(part => {
				if (typeof part === "string") return part;
				if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
					return (part as { text: string }).text;
				}
				return "";
			})
			.filter(Boolean)
			.join("\n");
	}
	return "";
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function slug(text: string): string {
	return text.replace(/\s+/g, " ").trim().slice(0, 48) || "row";
}
