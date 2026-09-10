// Lease + handoff-transfer conformance (M8 seed): ownership, steal
// refusal, expiry/renew/re swept on a fake clock; bundle integrity and
// explicit environment mismatch. Pure sync — no timers, no I/O.
import { describe, expect, it } from "vitest";

import { LeaseRegistry, LeaseError } from "./lease.ts";
import { manifestForBundle, checkHandoff, HandoffError, currentEnv } from "./handoff.ts";

describe("CloudLease", () => {
  it("holds one owner and refuses steals", () => {
    const leases = new LeaseRegistry();
    const t0 = 1_000_000;
    const first = leases.acquire("run-1", "laptop", 60_000, t0);
    expect(leases.held("run-1", t0)?.owner).toBe("laptop");
    expect(() => leases.acquire("run-1", "cloud", 60_000, t0 + 1000)).toThrow(LeaseError);
    expect(() => leases.acquire("run-1", "cloud", 60_000, t0 + 1000)).toThrow(/held by laptop/);
    expect(first.id).toMatch(/^lease-\d+$/);
  });

  it("renews for the owner, refuses strangers and the expired", () => {
    const leases = new LeaseRegistry();
    const t0 = 2_000_000;
    const lease = leases.acquire("run-1", "laptop", 10_000, t0);
    const renewed = leases.renew(lease.id, "laptop", 60_000, t0 + 5000);
    expect(renewed.expiresAt).toBe(t0 + 5000 + 60_000);
    expect(() => leases.renew(lease.id, "cloud", 60_000, t0 + 6000)).toThrow(/belongs to laptop/);
    expect(() => leases.renew(lease.id, "laptop", 60_000, t0 + 5000 + 60_001)).toThrow(/expired/);
    // Expired leases read as free even before an explicit sweep.
    expect(leases.held("run-1", t0 + 5000 + 60_001)).toBeNull();
  });

  it("releases for the owner and sweeps the expired", () => {
    const leases = new LeaseRegistry();
    const t0 = 3_000_000;
    const a = leases.acquire("run-a", "laptop", 60_000, t0);
    const b = leases.acquire("run-b", "laptop", 1000, t0);
    expect(() => leases.release(a.id, "cloud")).toThrow(/belongs to laptop/);
    leases.release(a.id, "laptop");
    expect(leases.held("run-a", t0)).toBeNull();
    expect(leases.sweep(t0 + 2000)).toEqual([b.id]);
    expect(leases.held("run-b", t0 + 2000)).toBeNull();
    expect(() => leases.release("lease-999", "laptop")).toThrow(/unknown lease/);
    // Freed resources acquire again.
    expect(leases.acquire("run-a", "cloud", 60_000, t0 + 3000).owner).toBe("cloud");
  });
});

describe("HandoffTransfer", () => {
  const bytes = JSON.stringify({ version: 1, threadId: "caret-slice-9", goal: "x" });

  it("accepts an intact bundle in the same environment", () => {
    const manifest = manifestForBundle(bytes, "caret-slice-9");
    expect(manifest.threadId).toBe("caret-slice-9");
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(checkHandoff(manifest, bytes)).toEqual({ ok: true });
  });

  it("rejects tampered or truncated bytes", () => {
    const manifest = manifestForBundle(bytes, "caret-slice-9");
    expect(() => checkHandoff(manifest, `${bytes} `)).toThrow(HandoffError);
    expect(() => checkHandoff(manifest, `${bytes} `)).toThrow(/sha256 mismatch/);
    expect(() => checkHandoff(manifest, bytes.slice(0, -2))).toThrow(/mismatch/);
  });

  it("rejects environment drift explicitly", () => {
    const env = currentEnv();
    const manifest = manifestForBundle(bytes, "caret-slice-9");
    const otherOs = env.os === "darwin" ? "linux" : "darwin";
    expect(() => checkHandoff(manifest, bytes, { ...env, os: otherOs })).toThrow(/environment: os/);
    expect(() => checkHandoff(manifest, bytes, { ...env, arch: "mips" })).toThrow(/environment: arch/);
    expect(() => checkHandoff(manifest, bytes, { ...env, node: "v0.0.1" })).toThrow(/environment: node/);
    // Same major is fine (patch drift is not a handoff break).
    const sameMajor = { ...env, node: `v${env.node.replace(/^v/, "").split(".")[0]}.99.99` };
    expect(checkHandoff(manifest, bytes, sameMajor)).toEqual({ ok: true });
  });
});
