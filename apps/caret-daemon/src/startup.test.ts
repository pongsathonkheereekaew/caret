// Startup check conformance (M2): port parsing, journal writability,
// summary assembly. Pure sync (+ one tmpdir probe).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parsePort, journalWritable, describeStartup, StartupError } from "./startup.ts";

describe("StartupChecks", () => {
  it("parses ports with safe defaults", () => {
    expect(parsePort(undefined, 0)).toBe(0);
    expect(parsePort("", 13000)).toBe(13000);
    expect(parsePort("8080", 0)).toBe(8080);
    expect(() => parsePort("abc", 0)).toThrow(StartupError);
    expect(() => parsePort("-1", 0)).toThrow(StartupError);
    expect(() => parsePort("99999", 0)).toThrow(StartupError);
    expect(() => parsePort("80.5", 0)).toThrow(StartupError);
  });

  it("probes journal writability without side effects", () => {
    const dir = mkdtempSync(join(tmpdir(), "caret-startup-"));
    try {
      expect(journalWritable(join(dir, "sub", "journal.jsonl"))).toBe(true);
      expect(journalWritable(join(dir, "nope", "x", "journal.jsonl"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(journalWritable("/proc/definitely-not-here-xyz/journal.jsonl")).toBe(false);
  });

  it("assembles the startup summary from env", () => {
    expect(describeStartup({})).toEqual({
      host: "127.0.0.1",
      port: 0,
      journal: "/tmp/caret-daemon-journal.jsonl",
      pairing: "file",
    });
    expect(
      describeStartup({ CARET_HOST: "0.0.0.0", CARET_PORT: "13001", CARET_PAIRING: "x" }),
    ).toMatchObject({ host: "0.0.0.0", port: 13001, pairing: "env" });
  });
});
