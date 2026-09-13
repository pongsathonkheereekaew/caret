import type { Command, CommandRequest, Json } from "../../../../packages/protocol/src/index.ts";
import { isRecord } from "./types.ts";

export type CommandLedgerStatus = "queued" | "sent" | "completed" | "failed" | "unknown" | "not_dispatched";

export interface CommandIntent {
  readonly commandId: string;
  readonly incarnation: string;
  readonly command: string;
  readonly payload: Record<string, Json>;
}

export interface LedgerRecord extends CommandIntent {
  readonly status: CommandLedgerStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly error?: string;
}

export class CommandConflictError extends Error {
  readonly code = "command-conflict";
  constructor(commandId: string) {
    super(`Command id already belongs to a different request: ${commandId}`);
    this.name = "CommandConflictError";
  }
}

export class CommandRetryError extends Error {
  readonly code = "command-retry-not-allowed";
  constructor(commandId: string, message: string) {
    super(`Cannot retry ${commandId}: ${message}`);
    this.name = "CommandRetryError";
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("command payload numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  throw new TypeError("command payload must contain JSON values");
}

export function commandPayloadHash(intent: Pick<CommandIntent, "command" | "incarnation" | "payload">): string {
  return canonical({ command: intent.command, incarnation: intent.incarnation, payload: intent.payload });
}

function randomPart(): string {
  const cryptoObject = globalThis.crypto as Crypto & { randomUUID?: () => string } | undefined;
  if (typeof cryptoObject?.randomUUID === "function") return cryptoObject.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoObject?.getRandomValues !== "function") throw new Error("Secure random generator unavailable");
  cryptoObject.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Generate an ID once for an explicit user intent. Retries reuse this value. */
export function createCommandId(prefix = "cmd"): string {
  const safePrefix = prefix.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32) || "cmd";
  return `${safePrefix}_${randomPart()}`;
}

function statusFromCommand(command: Command): CommandLedgerStatus {
  switch (command.status) {
    case "claimed":
    case "acknowledged": return "sent";
    case "completed": return "completed";
    case "failed": return "failed";
    case "outcome_unknown": return "unknown";
    case "not_dispatched": return "not_dispatched";
  }
}

function sameIntent(left: CommandIntent, right: CommandIntent): boolean {
  return left.incarnation === right.incarnation && left.command === right.command && commandPayloadHash(left) === commandPayloadHash(right);
}

/**
 * Client-side idempotency ledger. It deliberately has no automatic retry.
 * Only an explicit retryUnknown call can reuse a command id after an ambiguous
 * outcome; this protects mutations when the ACK or terminal frame was lost.
 */
export class CommandLedger {
  readonly #records = new Map<string, LedgerRecord>();

  create(input: { commandId?: string; incarnation: string; command: string; payload?: Record<string, Json> }): LedgerRecord {
    if (!input.incarnation.trim()) throw new TypeError("incarnation is required");
    if (!input.command.trim()) throw new TypeError("command is required");
    const intent: CommandIntent = {
      commandId: input.commandId ?? createCommandId(input.command),
      incarnation: input.incarnation,
      command: input.command,
      payload: input.payload ?? {},
    };
    const previous = this.#records.get(intent.commandId);
    if (previous) {
      if (!sameIntent(previous, intent)) throw new CommandConflictError(intent.commandId);
      return previous;
    }
    const now = Date.now();
    const record: LedgerRecord = { ...intent, status: "queued", createdAt: now, updatedAt: now };
    this.#records.set(record.commandId, record);
    return record;
  }

  get(commandId: string): LedgerRecord | undefined {
    return this.#records.get(commandId);
  }

  list(): readonly LedgerRecord[] {
    return [...this.#records.values()].sort((left, right) => left.createdAt - right.createdAt);
  }

  mark(commandId: string, status: CommandLedgerStatus, error?: string): LedgerRecord {
    const current = this.#records.get(commandId);
    if (!current) throw new Error(`Unknown command id: ${commandId}`);
    const next: LedgerRecord = { ...current, status, ...(error ? { error } : {}), updatedAt: Date.now() };
    this.#records.set(commandId, next);
    return next;
  }

  absorb(command: Command): LedgerRecord {
    const current = this.#records.get(command.commandId);
    if (!current) {
      const created = this.create({ commandId: command.commandId, incarnation: command.incarnation, command: command.kind, payload: isRecord(command.payload) ? command.payload as Record<string, Json> : {} });
      return this.mark(created.commandId, statusFromCommand(command), command.error);
    }
    // The host hashes deviceId + incarnation + kind + payload. The mobile
    // ledger intentionally does not persist device identity in its public
    // record, so the server remains the authority for that full hash check.
    if (current.incarnation !== command.incarnation || current.command !== command.kind) {
      throw new CommandConflictError(command.commandId);
    }
    return this.mark(command.commandId, statusFromCommand(command), command.error);
  }

  markUnknown(commandId: string, error?: string): LedgerRecord {
    return this.mark(commandId, "unknown", error);
  }

  /** Reuse an unknown id only after an explicit user action. */
  retryUnknown(commandId: string, explicitUserAction = false): LedgerRecord {
    const current = this.#records.get(commandId);
    if (!current) throw new CommandRetryError(commandId, "the command is not known");
    if (!explicitUserAction) throw new CommandRetryError(commandId, "an explicit user action is required");
    if (current.status !== "unknown") throw new CommandRetryError(commandId, `status is ${current.status}`);
    return this.mark(commandId, "queued");
  }

  request(commandId: string): CommandRequest {
    const record = this.#records.get(commandId);
    if (!record) throw new Error(`Unknown command id: ${commandId}`);
    return { commandId: record.commandId, incarnation: record.incarnation, command: record.command, payload: record.payload };
  }

  snapshot(): readonly LedgerRecord[] {
    return this.list().map(record => ({ ...record, payload: { ...record.payload } }));
  }

  restore(records: readonly LedgerRecord[]): void {
    for (const record of records) {
      if (!record.commandId || !record.incarnation || !record.command) continue;
      const existing = this.#records.get(record.commandId);
      if (existing && !sameIntent(existing, record)) throw new CommandConflictError(record.commandId);
      this.#records.set(record.commandId, { ...record, payload: { ...record.payload } });
    }
  }
}
