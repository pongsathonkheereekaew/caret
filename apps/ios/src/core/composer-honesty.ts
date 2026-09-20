import {
  composerAxesFromTask,
  resolveComposerControls,
  type ComposerControls,
  type ComposerTaskSnapshot,
} from "../../../macos/src/composer-runtime.ts";
import type { ModelOption } from "./types.ts";

/** Host upload is not advertised on this phone. Do not invent a dispatch path. */
export const IOS_HOST_UPLOAD_ADVERTISED = false;

export const IOS_HOST_UPLOAD_COPY =
  "Host file upload is not advertised on this phone. Remove is N/A until a receipt exists.";

export const IOS_COMPOSER_CHOOSE_MODEL = "Choose a model";
export const IOS_COMPOSER_ADD_MESSAGE = "Add a message";
export const IOS_COMPOSER_NO_SESSION = "This session runs on your Mac. Start it once, then continue from anywhere.";
export const IOS_COMPOSER_HOST_OFFLINE = "ติดต่อ Mac ไม่ได้ — เก็บฉบับร่างไว้แล้ว";
export const IOS_COMPOSER_MODEL_BLOCKED = "Model changes stay on the Mac until this phone is connected and idle.";
export const IOS_COMPOSER_MODEL_UNAVAILABLE = "OMP did not advertise this model as available.";
export const IOS_COMPOSER_QUEUE_IDLE = "Queue stays unavailable until this session is running on the Mac.";
export const IOS_COMPOSER_STEER_IDLE = "Steer stays unavailable until this session is running on the Mac.";
export const IOS_COMPOSER_STOP_IDLE = "Stop stays unavailable until this session is running on the Mac.";

const MACOS_ADD_MESSAGE_OR_ATTACHMENT = "Add a message or attachment";
const MACOS_UPLOAD_FAILED = "แนบไฟล์ไม่สำเร็จ ข้อความยังอยู่";

export interface IosComposerSnapshot extends ComposerTaskSnapshot {
  readonly models?: readonly ModelOption[];
}

export interface IosComposerHonesty extends ComposerControls {
  readonly queueReason: string;
  readonly steerReason: string;
  readonly stopReason: string;
  readonly modelReason: string;
  readonly uploadAdvertised: false;
  readonly uploadReason: string;
}

export function advertisedModelId(input: {
  readonly models?: readonly ModelOption[] | null;
  readonly selectedModel?: string | null;
}): string | undefined {
  const selected = typeof input.selectedModel === "string" ? input.selectedModel.trim() : "";
  if (!selected) return undefined;
  const models = input.models ?? [];
  if (models.length === 0) return undefined;
  const option = models.find(model => model.id === selected);
  if (!option || !modelOptionSelectable(option)) return undefined;
  return selected;
}

export function modelOptionSelectable(model: ModelOption): boolean {
  return model.available !== false;
}

export function iosComposerHonesty(state: IosComposerSnapshot): IosComposerHonesty {
  const advertised = advertisedModelId(state);
  const hasSession = Boolean(state.session?.id);
  const hostOffline = isHostOffline(state.connection);
  const controls = resolveComposerControls(composerAxesFromTask({
    ...state,
    selectedModel: advertised,
  }, {
    attachmentsReady: 0,
    attachmentsPending: 0,
    attachmentsFailed: 0,
  }));

  const dispatchAllowed = hasSession && !hostOffline && Boolean(advertised);
  const inspectOnly = controls.primary === "check_status" || controls.primary === "choose_project";
  const primaryEnabled = inspectOnly ? controls.primaryEnabled && hasSession : controls.primaryEnabled && dispatchAllowed;
  const queueEnabled = controls.queueEnabled && dispatchAllowed;
  const steerEnabled = controls.steerEnabled && dispatchAllowed;
  const stopEnabled = controls.stopEnabled && hasSession && !hostOffline;
  const modelEnabled = controls.modelEnabled && hasSession && !hostOffline;
  const sendIntent = primaryEnabled ? controls.sendIntent : null;
  const primaryReason = reasonForPrimary(controls, { advertised, hasSession, hostOffline });

  return {
    ...controls,
    primaryEnabled,
    queueEnabled,
    steerEnabled,
    stopEnabled,
    modelEnabled,
    sendIntent,
    primaryReason,
    queueReason: reasonForAction("queue", queueEnabled, controls, { advertised, hasSession, hostOffline, primaryReason }),
    steerReason: reasonForAction("steer", steerEnabled, controls, { advertised, hasSession, hostOffline, primaryReason }),
    stopReason: reasonForAction("stop", stopEnabled, controls, { advertised, hasSession, hostOffline, primaryReason }),
    modelReason: modelEnabled ? "" : (hasSession && !hostOffline ? IOS_COMPOSER_MODEL_BLOCKED : hostOffline ? IOS_COMPOSER_HOST_OFFLINE : IOS_COMPOSER_NO_SESSION),
    uploadAdvertised: false,
    uploadReason: IOS_HOST_UPLOAD_COPY,
  };
}

export function iosComposerAllowsCommand(honesty: IosComposerHonesty, command: string): boolean {
  if (command === "prompt") return honesty.sendIntent === "send_prompt" && honesty.primaryEnabled;
  if (command === "follow_up") return honesty.queueEnabled || honesty.sendIntent === "follow_up";
  if (command === "steer") return honesty.steerEnabled;
  if (command === "abort" || command === "stop" || command === "cancel") return honesty.stopEnabled;
  return true;
}

function isHostOffline(connection: string | null | undefined): boolean {
  return connection === "offline" || connection === "connecting" || connection === "reconnecting";
}

function reasonForPrimary(
  controls: ComposerControls,
  gates: { advertised?: string; hasSession: boolean; hostOffline: boolean },
): string {
  if (!gates.hasSession) return IOS_COMPOSER_NO_SESSION;
  if (controls.primary === "waiting_host" || gates.hostOffline) return controls.primaryReason || IOS_COMPOSER_HOST_OFFLINE;
  if (!gates.advertised && (controls.primary === "send" || controls.primary === "queue")) return IOS_COMPOSER_CHOOSE_MODEL;
  return honestPayloadReason(controls.primaryReason);
}

function reasonForAction(
  action: "queue" | "steer" | "stop",
  enabled: boolean,
  controls: ComposerControls,
  gates: { advertised?: string; hasSession: boolean; hostOffline: boolean; primaryReason: string },
): string {
  if (enabled) return "";
  if (!gates.hasSession) return IOS_COMPOSER_NO_SESSION;
  if (controls.primary === "waiting_host" || gates.hostOffline) return IOS_COMPOSER_HOST_OFFLINE;
  if (action === "stop") return IOS_COMPOSER_STOP_IDLE;
  if (!gates.advertised) return IOS_COMPOSER_CHOOSE_MODEL;
  const payload = honestPayloadReason(gates.primaryReason || controls.primaryReason);
  if (payload) return payload;
  return action === "queue" ? IOS_COMPOSER_QUEUE_IDLE : IOS_COMPOSER_STEER_IDLE;
}

function honestPayloadReason(reason: string): string {
  if (reason === MACOS_ADD_MESSAGE_OR_ATTACHMENT) return IOS_COMPOSER_ADD_MESSAGE;
  if (reason === MACOS_UPLOAD_FAILED) return IOS_HOST_UPLOAD_COPY;
  return reason;
}
