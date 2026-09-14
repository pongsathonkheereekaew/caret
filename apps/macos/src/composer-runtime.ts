export type ConnectionAxis = "offline" | "connecting" | "connected" | "replaying" | "unknown";
export type RunAxis = "idle" | "running" | "stopping" | "waiting_input";
export type DeliveryAxis = "idle" | "awaiting_ack" | "queued" | "unknown";
export type ModelReadiness = "ready" | "not_selected" | "unavailable";

export interface ComposerAxes {
	readonly connection: ConnectionAxis;
	readonly run: RunAxis;
	readonly delivery: DeliveryAxis;
	readonly pendingRequests: number;
	readonly hasProject: boolean;
	readonly hasSession: boolean;
	readonly draft: string;
	readonly attachmentsReady: number;
	readonly attachmentsPending: number;
	readonly attachmentsFailed: number;
	readonly usablePayload: boolean;
	/** Kept for callers that only need the legacy capability bit. */
	readonly hasModel: boolean;
	readonly modelReadiness: ModelReadiness;
	readonly modelReason: string;
}

export type ComposerPrimary =
	| "choose_project"
	| "send"
	| "queue"
	| "sending"
	| "stopping"
	| "waiting_host"
	| "check_status";

export interface ComposerControls {
	readonly primary: ComposerPrimary;
	readonly primaryEnabled: boolean;
	readonly primaryLabel: string;
	readonly queueVisible: boolean;
	readonly queueEnabled: boolean;
	readonly steerEnabled: boolean;
	readonly stopEnabled: boolean;
	readonly stopLabel: string;
	readonly modelEnabled: boolean;
	readonly sendIntent: "send_prompt" | "follow_up" | null;
	readonly primaryReason: string;
	readonly queueReason: string;
	readonly steerReason: string;
	readonly stopReason: string;
}

export interface ComposerTaskSnapshot {
	readonly connection?: string | null;
	readonly project?: { readonly id?: string | null } | null;
	readonly session?: { readonly id?: string | null; readonly status?: string | null } | null;
	readonly draft?: string | null;
	readonly uiRequests?: readonly unknown[] | null;
	readonly pendingCommands?: Readonly<Record<string, ComposerPendingCommand>> | null;
	readonly selectedModel?: string | null;
}

export interface ComposerPendingCommand {
	readonly status?: string | null;
	readonly command?: string | null;
}

export interface ComposerAttachmentSnapshot {
	readonly attachmentsReady?: number;
	readonly attachmentsPending?: number;
	readonly attachmentsFailed?: number;
}

const PRIMARY_LABELS: Record<ComposerPrimary, string> = {
	choose_project: "Choose project",
	send: "Send",
	queue: "Queue",
	sending: "Sending…",
	stopping: "Stopping…",
	waiting_host: "Waiting for host",
	check_status: "Check status",
};

export function composerAxesFromTask(task: ComposerTaskSnapshot, extras: ComposerAttachmentSnapshot = {}): ComposerAxes {
	const draft = typeof task.draft === "string" ? task.draft : "";
	const attachmentsReady = count(extras.attachmentsReady);
	const attachmentsPending = count(extras.attachmentsPending);
	const attachmentsFailed = count(extras.attachmentsFailed);
	const pendingRequests = Array.isArray(task.uiRequests) ? task.uiRequests.length : 0;
	const hasProject = Boolean(task.project?.id);
	const hasSession = Boolean(task.session?.id);
	return {
		connection: connectionAxis(task.connection),
		run: runAxis(task, pendingRequests),
		delivery: deliveryAxis(task.pendingCommands),
		pendingRequests,
		hasProject,
		hasSession,
		draft,
		attachmentsReady,
		attachmentsPending,
		attachmentsFailed,
		usablePayload: hasUsablePayload(draft, attachmentsReady),
		hasModel: typeof task.selectedModel === "string" && task.selectedModel.trim().length > 0,
		modelReadiness: modelReadiness(task),
		modelReason: modelReason(task),
	};
}

export function resolveComposerControls(axes: ComposerAxes): ComposerControls {
	const hostReady = axes.connection === "connected";
	const unknownOutcome = axes.connection === "unknown" || axes.delivery === "unknown";
	const hostBlocked = axes.connection === "offline" || axes.connection === "replaying" || axes.connection === "connecting";
	const attachmentsBlocking = axes.attachmentsPending > 0 || axes.attachmentsFailed > 0;
	const dispatchReady = hostReady && axes.delivery === "idle" && !attachmentsBlocking && axes.usablePayload && axes.modelReadiness === "ready";
	const runActive = axes.run === "running" || axes.run === "waiting_input";
	const queueMode = runActive || axes.run === "stopping";

	let primary: ComposerPrimary;
	if (!axes.hasProject) primary = "choose_project";
	else if (unknownOutcome) primary = "check_status";
	else if (hostBlocked) primary = "waiting_host";
	else if (axes.run === "stopping") primary = "stopping";
	else if (axes.delivery === "awaiting_ack") primary = "sending";
	else if (queueMode) primary = "queue";
	else primary = "send";

	const primaryEnabled =
		primary === "choose_project" ||
		primary === "check_status" ||
		(primary === "send" && dispatchReady) ||
		(primary === "queue" && dispatchReady && axes.run !== "stopping");

	const queueVisible = axes.hasProject && queueMode && !unknownOutcome && !hostBlocked;
	const queueEnabled = queueVisible && dispatchReady && axes.run !== "stopping";
	const steerEnabled = hostReady && axes.run === "running" && axes.pendingRequests === 0 && dispatchReady && axes.delivery === "idle";
	const stopEnabled = hostReady && runActive && !unknownOutcome;
	const queueReason = queueEnabled ? "" : reasonForAction("Queue", axes, attachmentsBlocking, queueVisible);
	const steerReason = steerEnabled ? "" : reasonForAction("Steer", axes, attachmentsBlocking, axes.run === "running");
	const stopReason = stopEnabled ? "" : reasonForStop(axes, hostReady, unknownOutcome);
	const modelEnabled = hostReady && !unknownOutcome && axes.run === "idle" && axes.delivery === "idle" && axes.pendingRequests === 0;

	return {
		primary,
		primaryEnabled,
		primaryLabel: PRIMARY_LABELS[primary],
		queueVisible,
		queueEnabled,
		steerEnabled,
		stopEnabled,
		stopLabel: axes.run === "stopping" ? "Stopping…" : "Stop",
		modelEnabled,
		sendIntent: primary === "send" && primaryEnabled ? "send_prompt" : primary === "queue" && primaryEnabled ? "follow_up" : null,
		primaryReason: reasonFor(primary, axes, attachmentsBlocking),
		queueReason,
		steerReason,
		stopReason,
	};
}

function reasonForAction(action: string, axes: ComposerAxes, attachmentsBlocking: boolean, visible: boolean): string {
	if (!visible) return `${action} is unavailable in this state`;
	if (axes.modelReadiness !== "ready") return axes.modelReason;
	if (axes.connection !== "connected") return "Waiting for host connection";
	if (axes.delivery !== "idle") return "Waiting for the current command to resolve";
	if (attachmentsBlocking) return "Resolve attachment errors before sending";
	if (!axes.usablePayload) return "Add a message or attachment";
	if (axes.pendingRequests > 0) return "Resolve the pending question first";
	return `${action} is unavailable in this state`;
}

function reasonForStop(axes: ComposerAxes, hostReady: boolean, unknownOutcome: boolean): string {
	if (axes.run === "stopping") return "Stop is already in progress";
	if (unknownOutcome) return "Cannot stop until the run status is verified";
	if (!hostReady) return "Reconnect to stop the active run";
	return "No active run to stop";
}

function modelReadiness(task: ComposerTaskSnapshot): ModelReadiness {
	if (typeof task.selectedModel !== "string" || task.selectedModel.trim().length === 0) return "not_selected";
	if (task.connection === "offline" || task.connection === "replaying" || task.connection === "unknown") return "unavailable";
	return "ready";
}

function modelReason(task: ComposerTaskSnapshot): string {
	const readiness = modelReadiness(task);
	if (readiness === "not_selected") return "Choose a model";
	if (readiness === "unavailable") return "The selected model is unavailable while the host is offline";
	return "";
}

function reasonFor(primary: ComposerPrimary, axes: ComposerAxes, attachmentsBlocking: boolean): string {
	if (primary === "waiting_host") return "ติดต่อ Mac ไม่ได้ — เก็บฉบับร่างไว้แล้ว";
	if (primary === "sending") return "ส่งคำสั่งแล้ว กำลังรอการยืนยัน";
	if (primary === "send" || primary === "queue") {
		if (axes.modelReadiness !== "ready") return axes.modelReason;
		if (attachmentsBlocking) return "แนบไฟล์ไม่สำเร็จ ข้อความยังอยู่";
		if (!axes.usablePayload) return "Add a message or attachment";
	}
	if (primary === "check_status") return "ยังยืนยันผลคำสั่งไม่ได้ อย่าส่งซ้ำจนกว่าจะตรวจสอบ";
	return "";
}

export function shouldSendOnEnter(opts: {
	readonly composing: boolean;
	readonly shiftKey: boolean;
	readonly metaKey: boolean;
	readonly submitEnter?: boolean;
	readonly controls: ComposerControls;
}): "send" | "queue" | "newline" | "ignore" {
	if (opts.composing) return "ignore";
	if (opts.shiftKey) return "newline";
	const submitEnter = opts.submitEnter !== false;
	if (!submitEnter) {
		if (!opts.metaKey) return "newline";
		return primaryEnterIntent(opts.controls);
	}
	if (opts.metaKey) {
		if (opts.controls.queueEnabled) return "queue";
		return "newline";
	}
	return primaryEnterIntent(opts.controls);
}

function primaryEnterIntent(controls: ComposerControls): "send" | "queue" | "ignore" {
	if (controls.primary === "send" && controls.primaryEnabled) return "send";
	if (controls.primary === "queue" && controls.primaryEnabled) return "queue";
	return "ignore";
}

function count(value: number | undefined): number {
	return typeof value === "number" && value > 0 ? value : 0;
}

function hasUsablePayload(draft: string, attachmentsReady: number): boolean {
	return draft.trim().length > 0 || attachmentsReady > 0;
}

function connectionAxis(value: string | null | undefined): ConnectionAxis {
	if (value === "offline" || value === "connecting" || value === "connected" || value === "replaying" || value === "unknown") return value;
	if (value === "reconnecting") return "connecting";
	if (value === "running") return "connected";
	return "unknown";
}

function runAxis(task: ComposerTaskSnapshot, pendingRequests: number): RunAxis {
	const commands = Object.values(task.pendingCommands ?? {});
	if (commands.some((command) => isAbort(command) && (command.status === "sent" || command.status === "queued"))) return "stopping";
	const status = task.session?.status;
	if (status === "running" && pendingRequests > 0) return "waiting_input";
	if (status === "running") return "running";
	return "idle";
}

function deliveryAxis(pending: ComposerTaskSnapshot["pendingCommands"]): DeliveryAxis {
	const commands = Object.values(pending ?? {}).filter((command) => !isAbort(command));
	if (commands.some((command) => command.status === "unknown")) return "unknown";
	if (commands.some((command) => command.status === "sent")) return "awaiting_ack";
	if (commands.some((command) => command.status === "queued")) return "queued";
	return "idle";
}

function isAbort(command: ComposerPendingCommand): boolean {
	const name = command.command ?? "";
	return name === "abort" || name === "stop" || name === "cancel";
}
