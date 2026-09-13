import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeviceAuth } from "../src/auth.ts";

const directories: string[] = [];

function temporaryAuth(): { directory: string; auth: DeviceAuth } {
  const directory = mkdtempSync(join(tmpdir(), "caret-auth-"));
  directories.push(directory);
  return { directory, auth: new DeviceAuth(directory) };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("DeviceAuth", () => {
  it("creates a private owner credential and never exposes token hashes", () => {
    const { directory, auth } = temporaryAuth();
    const owner = auth.authenticate(auth.ownerToken);
    expect(owner).toMatchObject({ role: "owner", name: "This Mac" });
    expect(auth.authenticate("wrong-token")).toBeUndefined();
    expect(auth.list()).toHaveLength(1);
    expect(auth.list()[0]).not.toHaveProperty("tokenHash");
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, "devices.json")).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(join(directory, "devices.json"), "utf8"))).toMatchObject({ version: 1 });
  });

  it("issues a controller token, persists it, and revokes it without affecting the owner", () => {
    const { directory, auth } = temporaryAuth();
    const issued = auth.issue("  iPhone  ");
    expect(issued.device).toMatchObject({ role: "controller", name: "iPhone" });
    expect(issued.device).not.toHaveProperty("tokenHash");
    expect(auth.authenticate(issued.token)).toMatchObject({ id: issued.device.id, role: "controller" });

    const reopened = new DeviceAuth(directory);
    expect(reopened.authenticate(issued.token)).toMatchObject({ id: issued.device.id });
    reopened.revoke(issued.device.id);
    expect(reopened.authenticate(issued.token)).toBeUndefined();
    expect(reopened.authenticate(reopened.ownerToken)).toMatchObject({ role: "owner" });
    expect(reopened.revoke(issued.device.id)).toBeUndefined();
  });

  it("rejects malformed names, capacity overflow, and owner revocation", () => {
    const { auth } = temporaryAuth();
    expect(() => auth.issue("   ")).toThrow(/1–100/);
    expect(() => auth.issue("x".repeat(101))).toThrow(/1–100/);
    expect(() => auth.revoke(auth.list()[0]!.id)).toThrow(/owner/i);
    expect(() => auth.revoke("missing-device")).toThrow(/not found/i);
  });
});
