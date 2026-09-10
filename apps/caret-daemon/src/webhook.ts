// Caret webhook intake guard (M9 seed): duplicate/late/out-of-order
// deliveries never act twice. Pure + deterministic (timestamps are
// parameters). Honest bound: the id window is capped — replays older than
// the window apply again, so providers must stay inside it (documented,
// keeper-pinned).
export class WebhookError extends Error {}

export interface WebhookEvent {
  /** Provider delivery id (idempotency key). */
  readonly id: string;
  /** Event kind, e.g. "pr.commented". */
  readonly kind: string;
  /** Entity the event acts on, e.g. "owner/repo#123". */
  readonly key: string;
  /** Provider timestamp (ms). Drives stale detection. */
  readonly at: number;
  readonly payload?: unknown;
}

export type WebhookVerdict =
  | { action: "apply" }
  | { action: "skip"; reason: string };

export class WebhookDedup {
  private readonly seen: string[] = [];
  private readonly watermarks = new Map<string, number>();

  constructor(private readonly cap = 1000) {}

  check(event: WebhookEvent): WebhookVerdict {
    if (!event.id) {
      throw new WebhookError("webhook without delivery id");
    }
    if (this.seen.includes(event.id)) {
      return { action: "skip", reason: `duplicate delivery ${event.id}` };
    }
    this.seen.push(event.id);
    if (this.seen.length > this.cap) {
      this.seen.shift();
    }
    const mark = `${event.kind}\n${event.key}`;
    const last = this.watermarks.get(mark) ?? Number.NEGATIVE_INFINITY;
    if (event.at < last) {
      return { action: "skip", reason: `stale ${event.kind} for ${event.key}` };
    }
    this.watermarks.set(mark, event.at);
    return { action: "apply" };
  }
}
