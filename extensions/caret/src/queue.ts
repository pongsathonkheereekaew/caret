// Caret composer queue (parity Phase A): local pending prompts while a
// turn runs. Pure — no vscode import; checked with bun directly. Drain
// order is FIFO; a failed turn keeps the remainder queued (operator
// resumes with Send). Cap 20: refuse loudly, never silently drop.
export class PendingQueue {
  private readonly items: string[] = [];

  constructor(readonly cap = 20) {}

  get size(): number {
    return this.items.length;
  }

  list(): string[] {
    return [...this.items];
  }

  /** Returns 1-based position. Throws when full. */
  enqueue(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("cannot queue empty prompt");
    if (this.items.length >= this.cap) {
      throw new Error(`queue full (${this.cap}) — Send after the turn drains`);
    }
    this.items.push(trimmed);
    return this.items.length;
  }

  removeAt(index: number): string {
    if (index < 0 || index >= this.items.length) {
      throw new Error(`queue has no #${index + 1}`);
    }
    return this.items.splice(index, 1)[0] as string;
  }

  takeNext(): string | null {
    return this.items.shift() ?? null;
  }

  clear(): number {
    const n = this.items.length;
    this.items.length = 0;
    return n;
  }
}
