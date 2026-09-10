// Caret handoff transfer check (M8 seed, F08 logic): a bundle crossing
// hosts carries an integrity hash + source environment; the receiver
// rejects tampering and explicit environment incompatibility instead of
// resuming into a lie. Pure, no I/O — the bytes come from the M7 bundle.
import * as Crypto from "node:crypto";

export interface RunEnvironment {
  readonly os: string;
  readonly arch: string;
  /** Full `process.version` (major compared on check). */
  readonly node: string;
}

export interface HandoffManifest {
  readonly version: 1;
  readonly threadId: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly env: RunEnvironment;
}

export class HandoffError extends Error {
  constructor(
    message: string,
    readonly reasons: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = "HandoffError";
  }
}

export const currentEnv = (): RunEnvironment => ({
  os: process.platform,
  arch: process.arch,
  node: process.version,
});

const major = (version: string): string => version.replace(/^v/, "").split(".")[0] ?? version;

export const manifestForBundle = (
  bundleJson: string,
  threadId: string,
  env: RunEnvironment = currentEnv(),
): HandoffManifest => ({
  version: 1,
  threadId,
  sha256: Crypto.createHash("sha256").update(bundleJson, "utf8").digest("hex"),
  bytes: Buffer.byteLength(bundleJson, "utf8"),
  env,
});

/** Verify bytes against the manifest in the receiving environment. */
export const checkHandoff = (
  manifest: HandoffManifest,
  bundleJson: string,
  env: RunEnvironment = currentEnv(),
): { ok: true } => {
  const reasons: string[] = [];
  if (manifest.version !== 1) reasons.push("manifest version !== 1");
  const digest = Crypto.createHash("sha256").update(bundleJson, "utf8").digest("hex");
  if (digest !== manifest.sha256) reasons.push("integrity: sha256 mismatch (tampered or truncated)");
  if (Buffer.byteLength(bundleJson, "utf8") !== manifest.bytes) reasons.push("integrity: byte length mismatch");
  if (env.os !== manifest.env.os) reasons.push(`environment: os ${manifest.env.os} → ${env.os}`);
  if (env.arch !== manifest.env.arch) reasons.push(`environment: arch ${manifest.env.arch} → ${env.arch}`);
  if (major(env.node) !== major(manifest.env.node)) {
    reasons.push(`environment: node ${manifest.env.node} → ${env.node}`);
  }
  if (reasons.length > 0) {
    throw new HandoffError(`handoff ${manifest.threadId} rejected: ${reasons.join("; ")}`, reasons);
  }
  return { ok: true };
};
