/** Pure Mac recovery copy for UI-S4. No vscode, no network. */

export type RecoveryConnection = "online" | "offline" | "reconnecting";

export interface RecoveryBannerInput {
	readonly connection: RecoveryConnection;
	readonly draftSaved: boolean;
	readonly outcomeUnknown: boolean;
	readonly pendingApprovals: number;
}

export type RecoveryActionId = "reconnect" | "inspect";

export interface RecoveryPrimaryAction {
	readonly id: RecoveryActionId;
	readonly label: string;
	/** Reconnect must not auto-answer stale approvals. */
	readonly autoAnswerApprovals: false;
}

export interface RecoveryBanner {
	readonly tone: "ok" | "warning" | "danger";
	readonly title: string;
	readonly body: string;
	readonly primaryAction: RecoveryPrimaryAction | null;
	readonly destructiveRetry: false;
}

const OFFLINE_SAVED_EN = "Can't reach the Mac — draft saved";
const OFFLINE_SAVED_TH = "ติดต่อ Mac ไม่ได้ — เก็บฉบับร่างไว้แล้ว";
const DRAFT_UNSAVED_EN = "Draft not saved";
const DRAFT_UNSAVED_TH = "ยังบันทึกฉบับร่างไม่ได้";
const OUTCOME_UNKNOWN_EN = "Command result is unconfirmed. Do not resend until you inspect it.";
const OUTCOME_UNKNOWN_TH = "ยังยืนยันผลคำสั่งไม่ได้ อย่าส่งซ้ำจนกว่าจะตรวจสอบ";

function reconnectAction(): RecoveryPrimaryAction {
	return { id: "reconnect", label: "Reconnect", autoAnswerApprovals: false };
}

function inspectAction(): RecoveryPrimaryAction {
	return { id: "inspect", label: "Inspect result", autoAnswerApprovals: false };
}

export function recoveryBanner(input: RecoveryBannerInput): RecoveryBanner {
	if (input.outcomeUnknown) {
		return {
			tone: "danger",
			title: OUTCOME_UNKNOWN_EN,
			body: `${OUTCOME_UNKNOWN_EN}\n${OUTCOME_UNKNOWN_TH}`,
			primaryAction: inspectAction(),
			destructiveRetry: false,
		};
	}

	if (input.connection === "offline" || input.connection === "reconnecting") {
		if (!input.draftSaved) {
			return {
				tone: "warning",
				title: DRAFT_UNSAVED_EN,
				body: `${DRAFT_UNSAVED_EN}\n${DRAFT_UNSAVED_TH}`,
				primaryAction: reconnectAction(),
				destructiveRetry: false,
			};
		}
		return {
			tone: "warning",
			title: OFFLINE_SAVED_EN,
			body: `${OFFLINE_SAVED_EN}\n${OFFLINE_SAVED_TH}`,
			primaryAction: reconnectAction(),
			destructiveRetry: false,
		};
	}

	return {
		tone: "ok",
		title: "",
		body: "",
		primaryAction: null,
		destructiveRetry: false,
	};
}
