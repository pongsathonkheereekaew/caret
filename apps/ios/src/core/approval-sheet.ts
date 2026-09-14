import { approvalCanSubmit, approvalDisplayStatus, type ApprovalStatus } from "../../../macos/src/approval-view.ts";
import type { PendingUiRequest } from "./types.ts";

export type { ApprovalStatus };

export type IosApprovalBinding = {
  readonly sessionId?: string;
  readonly incarnation?: string;
  readonly connection?: string;
};

function requestTimeout(request: PendingUiRequest): number | undefined {
  if (request.request.method === "editor") return undefined;
  return "timeout" in request.request ? request.request.timeout : undefined;
}

function requestReceivedAt(request: PendingUiRequest): number | undefined {
  return typeof request.receivedAt === "number" ? request.receivedAt : undefined;
}

export function iosApprovalDisplayStatus(
  request: PendingUiRequest,
  current: IosApprovalBinding,
  now = Date.now(),
): ApprovalStatus {
  return approvalDisplayStatus({
    token: request.token,
    requestId: request.request.id,
    sessionId: request.sessionId,
    incarnation: request.incarnation,
    method: request.request.method,
    cwd: request.cwd,
    tool: request.tool,
    target: request.target,
    timeout: requestTimeout(request),
    receivedAt: requestReceivedAt(request),
    status: request.status,
  }, current, now);
}

export function iosApprovalCanSubmit(status: ApprovalStatus, connection?: string): boolean {
  return approvalCanSubmit(status, connection);
}

export function iosApprovalStatusCopy(status: string): string {
  if (status === "responded_elsewhere") return "ตอบคำขอนี้จากอีกอุปกรณ์แล้ว";
  if (status === "stale" || status === "timeout") return "คำขอนี้ใช้ตอบไม่ได้แล้ว";
  if (status === "denied") return "Denied";
  if (status === "approved") return "Approved";
  return "";
}

export function iosApprovalReadonly(
  request: PendingUiRequest,
  current: IosApprovalBinding,
  connection?: string,
): boolean {
  return !iosApprovalCanSubmit(iosApprovalDisplayStatus(request, current), connection ?? current.connection);
}
