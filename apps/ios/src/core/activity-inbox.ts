import type { Command, PendingCommand, PendingUiRequest } from "./types.ts";

/** Unanswered live UI broker request. Activity lists it; it never answers. */
export interface ActivityInboxUiRequest {
  readonly kind: "ui_request";
  readonly token: string;
  readonly sessionId?: string;
  readonly incarnation?: string;
  readonly request: PendingUiRequest;
}

/** Unknown command outcome from task state. Not an approval. */
export interface ActivityInboxUnknownCommand {
  readonly kind: "unknown_command";
  readonly commandId: string;
  readonly sessionId?: string;
  readonly incarnation?: string;
  readonly command: string;
  readonly error?: string;
}

export type ActivityInboxItem = ActivityInboxUiRequest | ActivityInboxUnknownCommand;

export type ActivityInboxTapAction =
  | { readonly type: "open_session"; readonly sessionId: string }
  | { readonly type: "unavailable"; readonly reason: string };

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

export function activityInboxItemKey(item: ActivityInboxItem): string {
  return item.kind === "ui_request" ? `ui:${item.token}` : `cmd:${item.commandId}`;
}

function identityMatches(existing: ActivityInboxItem, incoming: ActivityInboxItem): boolean {
  return existing.kind === incoming.kind
    && activityInboxItemKey(existing) === activityInboxItemKey(incoming)
    && (existing.sessionId ?? "") === (incoming.sessionId ?? "")
    && (existing.incarnation ?? "") === (incoming.incarnation ?? "");
}

/** Merge by token/commandId. Same token+session+incarnation keeps the existing object. */
export function mergeActivityInbox(
  existing: readonly ActivityInboxItem[],
  incoming: readonly ActivityInboxItem[],
): ActivityInboxItem[] {
  const previous = new Map(existing.map(item => [activityInboxItemKey(item), item]));
  const seen = new Set<string>();
  const next: ActivityInboxItem[] = [];
  for (const item of incoming) {
    const key = activityInboxItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const mounted = previous.get(key);
    next.push(mounted && identityMatches(mounted, item) ? mounted : item);
  }
  return next;
}

export function activityInboxForSession(inbox: readonly ActivityInboxItem[], sessionId: string): ActivityInboxItem[] {
  const id = sessionId.trim();
  if (!id) return [];
  return inbox.filter(item => item.sessionId === id);
}

export function activityInboxSessionIds(inbox: readonly ActivityInboxItem[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of inbox) {
    const sessionId = activityInboxItemSessionId(item);
    if (!sessionId || seen.has(sessionId)) continue;
    seen.add(sessionId);
    ids.push(sessionId);
  }
  return ids;
}

export interface ActivityInboxFilterChip {
  readonly sessionId: "all" | string;
  readonly label: string;
}

/** All plus every session that already has inbox rows. Titles come from the loaded list. */
export function activityInboxFilterChips(
  inbox: readonly ActivityInboxItem[],
  sessions: readonly { readonly id: string; readonly title: string }[],
): ActivityInboxFilterChip[] {
  const chips: ActivityInboxFilterChip[] = [{ sessionId: "all", label: "All" }];
  const seen = new Set<string>();
  const add = (sessionId: string, label: string) => {
    if (seen.has(sessionId) || activityInboxForSession(inbox, sessionId).length === 0) return;
    seen.add(sessionId);
    chips.push({ sessionId, label });
  };
  for (const session of sessions) add(session.id, session.title.trim() || session.id);
  for (const sessionId of activityInboxSessionIds(inbox)) add(sessionId, sessionId);
  return chips;
}

export function activityInboxItemFromPendingUi(request: PendingUiRequest, sessionId?: string): ActivityInboxUiRequest | undefined {
  if (request.kind !== "interactive" || typeof request.token !== "string" || !request.token.trim()) return undefined;
  const resolvedSession = trimmed(request.sessionId) ?? trimmed(sessionId);
  const incarnation = trimmed(request.incarnation);
  return {
    kind: "ui_request",
    token: request.token,
    ...(resolvedSession ? { sessionId: resolvedSession } : {}),
    ...(incarnation ? { incarnation } : {}),
    request,
  };
}

export function activityInboxItemFromUnknownCommand(command: PendingCommand, sessionId?: string): ActivityInboxUnknownCommand | undefined {
  if (command.status !== "unknown" || typeof command.commandId !== "string" || !command.commandId.trim()) return undefined;
  const resolvedSession = trimmed(sessionId);
  const incarnation = trimmed(command.incarnation);
  return {
    kind: "unknown_command",
    commandId: command.commandId,
    ...(resolvedSession ? { sessionId: resolvedSession } : {}),
    ...(incarnation ? { incarnation } : {}),
    command: command.command,
    ...(command.error ? { error: command.error } : {}),
  };
}

export function activityInboxItemsFromUnknownCommands(
  pendingCommands: Readonly<Record<string, PendingCommand>>,
  sessionId?: string,
): ActivityInboxUnknownCommand[] {
  return Object.values(pendingCommands).flatMap(command => {
    const item = activityInboxItemFromUnknownCommand(command, sessionId);
    return item ? [item] : [];
  });
}

/** Host journal rows already marked outcome_unknown. Other statuses stay out. */
export function activityInboxItemFromHostCommand(command: Command, sessionId?: string): ActivityInboxUnknownCommand | undefined {
  if (command.status !== "outcome_unknown" || typeof command.commandId !== "string" || !command.commandId.trim()) return undefined;
  const resolvedSession = trimmed(command.sessionId) ?? trimmed(sessionId);
  const incarnation = trimmed(command.incarnation);
  const name = typeof command.kind === "string" ? command.kind : "";
  return {
    kind: "unknown_command",
    commandId: command.commandId,
    ...(resolvedSession ? { sessionId: resolvedSession } : {}),
    ...(incarnation ? { incarnation } : {}),
    command: name,
    ...(command.error ? { error: command.error } : {}),
  };
}

export function activityInboxItemsFromHostCommands(
  commands: readonly Command[],
  sessionId?: string,
): ActivityInboxUnknownCommand[] {
  return commands.flatMap(command => {
    const item = activityInboxItemFromHostCommand(command, sessionId);
    return item ? [item] : [];
  });
}

export function activityInboxItemSessionId(item: ActivityInboxItem): string | undefined {
  return trimmed(item.sessionId);
}

/** Tap opens the matching task only. It is never an Allow/Deny or UI answer. */
export function activityInboxTapAction(item: ActivityInboxItem): ActivityInboxTapAction {
  const sessionId = activityInboxItemSessionId(item);
  if (!sessionId) {
    return { type: "unavailable", reason: "This item has no session id, so it cannot be opened. Cedia will not invent a task." };
  }
  return { type: "open_session", sessionId };
}

/** Activity list tap never submits a UI answer. */
export function activityInboxTapAnswersRequest(_item?: ActivityInboxItem): false {
  return false;
}

export function activityInboxTitle(item: ActivityInboxItem): string {
  if (item.kind === "ui_request") {
    const title = item.request.request.title;
    return typeof title === "string" && title.trim() ? title : "Request";
  }
  return item.command.trim() ? `Unknown outcome · ${item.command}` : "Unknown command outcome";
}

export function activityInboxBody(item: ActivityInboxItem, sessionTitle?: string): string {
  if (item.kind === "unknown_command") {
    if (!activityInboxItemSessionId(item)) return "This unknown outcome has no session id, so it cannot be opened. Cedia will not invent a task or treat this as an approval.";
    if (!sessionTitle) return "This unknown outcome names a task that is not in the loaded list. Cedia will not invent a session or treat this as an approval.";
    return "Same Mac session — open the matching task. This is an unknown command outcome, not an approval. Cedia will not answer or replay it from this list.";
  }
  if (!activityInboxItemSessionId(item)) return "This request has no session id, so it cannot be opened. Cedia will not invent a task. Approvals are not answered from this list.";
  if (!sessionTitle) return "This request names a task that is not in the loaded list. Cedia will not invent a session. Approvals are not answered from this list automatically.";
  return "Same Mac session — open the matching task. Approvals are not answered from this list automatically.";
}
