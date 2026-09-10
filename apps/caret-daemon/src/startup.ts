// Caret daemon startup checks (M2 robustness): parse + verify the small
// env surface before listening, so misconfiguration fails fast with the
// reason instead of dying mid-run. Pure except one fs probe.
import * as Fs from "node:fs";
import * as NodePath from "node:path";

export class StartupError extends Error {}

export const parsePort = (value: string | undefined, def: number): number => {
  if (value === undefined || value.trim() === "") return def;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new StartupError(`bad port: ${JSON.stringify(value)}`);
  }
  return port;
};

/** Parent dir of the journal path exists and is writable. */
export const journalWritable = (journalPath: string): boolean => {
  try {
    const dir = NodePath.dirname(journalPath);
    Fs.mkdirSync(dir, { recursive: true });
    Fs.accessSync(dir, Fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

export interface StartupSummary {
  readonly host: string;
  readonly port: number;
  readonly journal: string;
  readonly pairing: "env" | "file";
}

export const describeStartup = (env: Record<string, string | undefined>): StartupSummary => ({
  host: env["CARET_HOST"]?.trim() || "127.0.0.1",
  port: parsePort(env["CARET_PORT"], 0),
  journal: env["CARET_JOURNAL"] ?? "/tmp/caret-daemon-journal.jsonl",
  pairing: env["CARET_PAIRING"] ? "env" : "file",
});
