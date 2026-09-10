// Caret cloud lease registry (M8 seed, F08 logic): acquire/renew/release
// with expiry for run ownership across hosts. Pure + deterministic — time
// is a parameter (same nowMs idiom as the prune keepers), no timers, no
// network. VM provisioning/destroy stays provider-side (blocked-external).
export class LeaseError extends Error {}

export interface Lease {
  readonly id: string;
  readonly resource: string;
  readonly owner: string;
  readonly expiresAt: number;
}

export class LeaseRegistry {
  private readonly byResource = new Map<string, Lease>();
  private counter = 0;

  acquire(resource: string, owner: string, ttlMs: number, nowMs = Date.now()): Lease {
    const live = this.byResource.get(resource);
    if (live !== undefined && live.expiresAt > nowMs) {
      throw new LeaseError(`held by ${live.owner} until ${new Date(live.expiresAt).toISOString()}`);
    }
    const lease: Lease = { id: `lease-${(this.counter += 1)}`, resource, owner, expiresAt: nowMs + ttlMs };
    this.byResource.set(resource, lease);
    return lease;
  }

  renew(id: string, owner: string, ttlMs: number, nowMs = Date.now()): Lease {
    const found = this.find(id);
    if (found.owner !== owner) {
      throw new LeaseError(`lease ${id} belongs to ${found.owner}`);
    }
    if (found.expiresAt <= nowMs) {
      this.byResource.delete(found.resource);
      throw new LeaseError(`lease ${id} expired`);
    }
    const next: Lease = { ...found, expiresAt: nowMs + ttlMs };
    this.byResource.set(next.resource, next);
    return next;
  }

  release(id: string, owner: string): void {
    const found = this.find(id);
    if (found.owner !== owner) {
      throw new LeaseError(`lease ${id} belongs to ${found.owner}`);
    }
    this.byResource.delete(found.resource);
  }

  held(resource: string, nowMs = Date.now()): Lease | null {
    const live = this.byResource.get(resource);
    return live !== undefined && live.expiresAt > nowMs ? live : null;
  }

  /** Drop expired leases; returns their ids (restart/lease-expiry path). */
  sweep(nowMs = Date.now()): string[] {
    const dropped: string[] = [];
    for (const [resource, lease] of this.byResource) {
      if (lease.expiresAt <= nowMs) {
        this.byResource.delete(resource);
        dropped.push(lease.id);
      }
    }
    return dropped;
  }

  private find(id: string): Lease {
    for (const lease of this.byResource.values()) {
      if (lease.id === id) return lease;
    }
    throw new LeaseError(`unknown lease ${id}`);
  }
}
