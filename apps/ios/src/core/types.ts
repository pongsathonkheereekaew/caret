import type {
  Command,
  CommandRequest,
  EventPage,
  Json,
  Project,
  Session,
  SessionEvent,
  UiResponseRequest,
} from "../../../../packages/protocol/src/index.ts";
import type { VirtualTerminalSnapshot } from "./virtual-terminal.ts";

export type { Command, CommandRequest, EventPage, Json, Project, Session, SessionEvent, UiResponseRequest };
export type { VirtualTerminalIdentity, VirtualTerminalOutput, VirtualTerminalSnapshot } from "./virtual-terminal.ts";

export type ConnectionState = "offline" | "connecting" | "connected" | "running" | "reconnecting" | "unknown";

export type TranscriptRole = "user" | "assistant" | "tool" | "system";
export type TranscriptKind = "message" | "tool" | "event";
export type TranscriptStatus = "streaming" | "completed" | "failed" | "unknown";
export type ToolStatus = "running" | "completed" | "failed" | "cancelled" | "unknown";

export interface TranscriptEntry {
  readonly id: string;
  readonly kind: TranscriptKind;
  readonly role: TranscriptRole;
  readonly text: string;
  readonly status: TranscriptStatus;
  readonly toolName?: string;
  readonly toolStatus?: ToolStatus;
  readonly args?: unknown;
  readonly output?: string;
  readonly createdAt?: string;
  readonly rawFrames: readonly Record<string, unknown>[];
}

export interface ModelOption {
  readonly id: string;
  readonly provider?: string;
  readonly label: string;
  readonly available?: boolean;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface LoginProviderOption {
  readonly id: string;
  readonly name: string;
  readonly available?: boolean;
  readonly authenticated?: boolean;
}

/** Non-interactive OMP UI notices. Login URLs stay here until the user opens them. */
export interface UiPresentation {
  readonly id: string;
  readonly method: string;
  readonly message?: string;
  readonly url?: string;
  readonly launchUrl?: string;
  readonly instructions?: string;
  readonly title?: string;
}

export type PendingCommandStatus = "queued" | "sent" | "completed" | "failed" | "unknown" | "not_dispatched";

export interface PendingCommand {
  readonly commandId: string;
  readonly incarnation: string;
  readonly command: string;
  readonly payload?: Record<string, Json>;
  readonly status: PendingCommandStatus;
  /** Commands are never replayed automatically after an offline or unknown outcome. */
  readonly replayable: false;
  readonly error?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ConfirmUiRequest {
  readonly method: "confirm";
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly timeout?: number;
}

export interface SelectUiRequest {
  readonly method: "select";
  readonly id: string;
  readonly title: string;
  readonly options: readonly string[];
  readonly optionDetails?: readonly { readonly description?: string }[];
  readonly timeout?: number;
}

export interface InputUiRequest {
  readonly method: "input";
  readonly id: string;
  readonly title: string;
  readonly placeholder?: string;
  readonly timeout?: number;
}

export interface EditorUiRequest {
  readonly method: "editor";
  readonly id: string;
  readonly title: string;
  readonly prefill?: string;
  readonly promptStyle?: boolean;
}

export type CediaUiRequest = ConfirmUiRequest | SelectUiRequest | InputUiRequest | EditorUiRequest;

export interface PendingUiRequest {
  readonly kind: "interactive";
  readonly token: string;
  readonly request: CediaUiRequest;
  readonly sessionId?: string;
  readonly incarnation?: string;
  readonly cwd?: string;
  readonly tool?: string;
  readonly target?: string;
  readonly status?: "pending" | "stale" | "timeout" | "responded_elsewhere" | "cancelled" | "approved" | "denied";
  readonly receivedAt?: number;
}

export interface CachedTaskSnapshot {
  readonly version: 1;
  readonly sessionId: string;
  readonly incarnation: string;
  readonly cursor: number;
  readonly events: readonly SessionEvent[];
  readonly savedAt: number;
  readonly expiresAt: number;
}

export interface MobileTaskState {
  readonly connection: ConnectionState;
  readonly lastError?: string;
  readonly project: Project | null;
  readonly projects: readonly Project[];
  readonly sessions: readonly Session[];
  readonly session: Session | null;
  readonly transcript: readonly TranscriptEntry[];
  /** OMP's opt-in virtual TUI terminals, scoped to the selected session incarnation. */
  readonly virtualTerminals: readonly VirtualTerminalSnapshot[];
  /** Ordered raw events retained for offline snapshot/replay. */
  readonly events: readonly SessionEvent[];
  readonly cursor: number;
  readonly hasMoreEvents: boolean;
  readonly cacheSavedAt?: number;
  readonly cacheExpiresAt?: number;
  readonly uiRequests: readonly PendingUiRequest[];
  readonly pendingCommands: Readonly<Record<string, PendingCommand>>;
  readonly activeToolIds: readonly string[];
  readonly activeMessageId?: string;
  readonly models: readonly ModelOption[];
  readonly selectedModel?: string;
  readonly loginProviders: readonly LoginProviderOption[];
  readonly presentations: readonly UiPresentation[];
  readonly draft: string;
  readonly searchQuery: string;
  readonly showArchived: boolean;
  readonly seenEventKeys: readonly string[];
  readonly attentionCount: number;
}

export interface SessionFrameEvent {
  readonly sessionId: string;
  readonly incarnation: string;
  readonly sequence: number;
  readonly timestamp: string;
  readonly frame: Json;
}

export type MobileEvent = SessionFrameEvent | { readonly frame: Json; readonly sequence?: number; readonly sessionId?: string; readonly incarnation?: string; readonly timestamp?: string };

export type MobileAction =
  | { readonly type: "reset"; readonly session?: Session | null; readonly project?: Project | null }
  | { readonly type: "connection"; readonly status: ConnectionState; readonly error?: string }
  | { readonly type: "projects"; readonly projects: readonly Project[] }
  | { readonly type: "project"; readonly project: Project | null }
  | { readonly type: "sessions"; readonly sessions: readonly Session[] }
  | { readonly type: "session"; readonly session: Session | null }
  /** Re-read the selected task's record without switching tasks or clearing its mounted view. */
  | { readonly type: "session_refresh"; readonly session: Session }
  /** Event pages carry the session identity captured before the HTTP request. */
  | { readonly type: "events"; readonly page: EventPage; readonly sessionId?: string; readonly incarnation?: string }
  | { readonly type: "event"; readonly event: MobileEvent }
  | { readonly type: "frame"; readonly frame: Json; readonly sequence?: number; readonly sessionId?: string; readonly incarnation?: string }
  | { readonly type: "draft"; readonly draft: string }
  | { readonly type: "search"; readonly query: string }
  | { readonly type: "show_archived"; readonly value: boolean }
  | { readonly type: "command_created"; readonly command: Pick<PendingCommand, "commandId" | "incarnation" | "command" | "payload"> }
  | { readonly type: "command_result"; readonly command: Command }
  | { readonly type: "command_status"; readonly commandId: string; readonly status: PendingCommandStatus; readonly error?: string }
  | { readonly type: "ui_request"; readonly event: unknown }
  /** Replace the live broker view after GET /ui; same-token inputs remain mounted. */
  | { readonly type: "ui_sync"; readonly events: readonly unknown[] }
  | { readonly type: "ui_resolved"; readonly token: string }
  | { readonly type: "models"; readonly models: readonly ModelOption[]; readonly selectedModel?: string }
  | { readonly type: "login_providers"; readonly providers: readonly LoginProviderOption[] }
  | { readonly type: "cached_meta"; readonly savedAt: number; readonly expiresAt: number }
  | { readonly type: "cache_cleared" };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonRecord(value: unknown): value is Record<string, Json> {
  return isRecord(value);
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
