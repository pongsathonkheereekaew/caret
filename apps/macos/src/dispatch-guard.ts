export type DispatchIntent = "send_prompt" | "follow_up" | "queue" | string;

export interface DispatchSource {
	readonly draftRevision: number;
	readonly attachmentRefs: readonly string[];
	readonly targetSession: string;
	readonly intent: DispatchIntent;
	readonly draft?: string;
}

export interface FrozenEnvelope {
	readonly commandId: string;
	readonly draftRevision: number;
	readonly attachmentRefs: readonly string[];
	readonly targetSession: string;
	readonly intent: DispatchIntent;
}

export type DispatchDecision =
	| { readonly dispatch: true; readonly envelope: FrozenEnvelope }
	| { readonly dispatch: false; readonly reason: "duplicate_click" | "empty" | "revision_mismatch" };

export function freezeEnvelope(source: DispatchSource): FrozenEnvelope {
	const attachmentRefs = Object.freeze([...source.attachmentRefs]);
	return {
		commandId: envelopeId(source.draftRevision, attachmentRefs, source.targetSession, source.intent),
		draftRevision: source.draftRevision,
		attachmentRefs,
		targetSession: source.targetSession,
		intent: source.intent,
	};
}

export function shouldDispatch(input: {
	readonly lastFrozen: FrozenEnvelope | null | undefined;
	readonly next: DispatchSource;
	readonly inFlightCommandId?: string | null;
}): DispatchDecision {
	if (isEmpty(input.next)) {
		return { dispatch: false, reason: "empty" };
	}

	const envelope = freezeEnvelope(input.next);
	const inFlight = Boolean(input.inFlightCommandId);
	const last = input.lastFrozen;

	if (inFlight && last && sameCommand(last, envelope)) {
		return { dispatch: false, reason: "duplicate_click" };
	}

	if (inFlight && last && last.commandId === input.inFlightCommandId && last.draftRevision === envelope.draftRevision) {
		return { dispatch: false, reason: "duplicate_click" };
	}

	if (last && envelope.draftRevision < last.draftRevision) {
		return { dispatch: false, reason: "revision_mismatch" };
	}

	return { dispatch: true, envelope };
}

function isEmpty(source: DispatchSource): boolean {
	const draft = source.draft ?? "";
	return draft.trim().length === 0 && source.attachmentRefs.length === 0;
}

function sameCommand(a: FrozenEnvelope, b: FrozenEnvelope): boolean {
	return a.commandId === b.commandId;
}

function envelopeId(draftRevision: number, attachmentRefs: readonly string[], targetSession: string, intent: DispatchIntent): string {
	return `cmd:${targetSession}:${intent}:${draftRevision}:${attachmentRefs.join(",")}`;
}
