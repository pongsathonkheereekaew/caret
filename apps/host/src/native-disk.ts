import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
  writeSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { within } from "./workspaces.ts";

/** Maximum UTF-8 payload accepted by one guarded native disk transaction. */
export const MAX_NATIVE_DISK_BYTES = 8 * 1024 * 1024;

export interface NativeDiskApplyRequest {
  readonly cwd: string;
  /** Lexical path supplied by OMP. It may be a symlink alias inside cwd. */
  readonly path: string;
  /** Canonical regular-file path observed during the model preflight. */
  readonly expectedCanonicalPath: string;
  readonly expectedText: string;
  readonly content: string;
}

export interface NativeDiskApplyResult {
  readonly text: string;
  readonly saved: true;
  readonly canonicalPath: string;
}

/**
 * A guarded disk operation whose write may already have happened. Callers
 * must surface this state to OMP and must never retry it automatically.
 */
export class NativeDiskApplyError extends Error {
  readonly mayHaveApplied: boolean;
  constructor(message: string, options: { mayHaveApplied?: boolean; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "NativeDiskApplyError";
    this.mayHaveApplied = options.mayHaveApplied === true;
  }
}

function bytes(value: string, label: string): Buffer {
  // Check the encoded size before allocating the payload buffer. OMP input is
  // JSON text and may otherwise contain a very large UTF-16 string despite the
  // native transaction's 8 MiB wire limit.
  if (Buffer.byteLength(value, "utf8") > MAX_NATIVE_DISK_BYTES) throw new NativeDiskApplyError(`${label} exceeds the 8 MiB native disk limit`);
  return Buffer.from(value, "utf8");
}

function invalid(message: string): NativeDiskApplyError {
  return new NativeDiskApplyError(message, { mayHaveApplied: false });
}

function readBounded(fd: number, length: number): Buffer {
  // The extra byte distinguishes an exact match from a file that has grown,
  // while still bounding every read to the caller's observed size + one.
  const target = Math.min(length + 1, MAX_NATIVE_DISK_BYTES + 1);
  const output = Buffer.allocUnsafe(target);
  let offset = 0;
  while (offset < target) {
    const count = readSync(fd, output, offset, target - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  return output.subarray(0, offset);
}

function sameIdentity(a: { dev: number; ino: number }, b: { dev: number; ino: number }): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

function writeAll(fd: number, content: Buffer): void {
  let offset = 0;
  while (offset < content.byteLength) {
    const count = writeSync(fd, content, offset, content.byteLength - offset, offset);
    if (count <= 0) throw new Error("Native disk write made no progress");
    offset += count;
  }
}

function assertLexicalTarget(lexicalPath: string, canonicalPath: string, workspaceRoot: string): void {
  let current: string;
  try { current = realpathSync(lexicalPath); }
  catch (error) { throw invalid(`Native disk path is unavailable before write: ${error instanceof Error ? error.message : String(error)}`); }
  if (current !== canonicalPath) throw invalid("Native disk path target changed before write");
  if (!within(workspaceRoot, current)) throw invalid("Native disk path resolves outside this workspace");
}

/**
 * Apply one optimistic, guarded disk transaction synchronously.
 *
 * This is deliberately not an OS-level compare-and-swap against unrelated
 * writers: another process can still modify the same inode after the final
 * identity check. The same descriptor is used for the entire effect and all
 * postconditions are verified; an error after the first write is reported as
 * mayHaveApplied and is never rolled back or replayed.
 */
export function applyNativeDisk(request: NativeDiskApplyRequest): NativeDiskApplyResult {
  if (!request || typeof request !== "object") throw invalid("Invalid native disk request");
  if (typeof request.cwd !== "string" || typeof request.path !== "string" || !request.path) throw invalid("Invalid native disk path");
  if (typeof request.expectedCanonicalPath !== "string" || !isAbsolute(request.expectedCanonicalPath)) throw invalid("Expected canonical path must be absolute");
  if (typeof request.expectedText !== "string" || typeof request.content !== "string") throw invalid("Native disk expected text and content must be strings");
  const expected = bytes(request.expectedText, "Expected text");
  const content = bytes(request.content, "Content");

  let workspaceRoot: string;
  try { workspaceRoot = realpathSync(request.cwd); }
  catch (error) { throw invalid(`Native disk workspace is unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  try { if (!statSync(workspaceRoot).isDirectory()) throw invalid("Native disk workspace must be a directory"); }
  catch (error) {
    if (error instanceof NativeDiskApplyError) throw error;
    throw invalid(`Native disk workspace is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const lexicalRoot = resolve(request.cwd);
  const lexicalPath = resolve(lexicalRoot, request.path);
  // Workspace aliases (including macOS /var) may differ lexically.
  // Authorize only their canonical target, then recheck the original alias before writing.

  const expectedPath = resolve(request.expectedCanonicalPath);
  if (!within(workspaceRoot, expectedPath)) throw invalid("Expected canonical path is outside this workspace");
  let initialLexicalCanonical: string;
  let canonicalExpected: string;
  try {
    initialLexicalCanonical = realpathSync(lexicalPath);
    canonicalExpected = realpathSync(expectedPath);
  } catch (error) {
    throw invalid(`Native disk path is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  // The expected path must itself be canonical. A symlink is allowed only as
  // the lexical request alias; opening the canonical target avoids following a
  // mutable final-component symlink during the effect.
  if (canonicalExpected !== expectedPath) throw invalid("Expected canonical path is not canonical");
  if (initialLexicalCanonical !== canonicalExpected) throw invalid("Native disk path target does not match expected canonical path");
  if (!within(workspaceRoot, initialLexicalCanonical)) throw invalid("Native disk path resolves outside this workspace");

  let fd: number;
  let expectedBeforeOpen: ReturnType<typeof statSync>;
  try {
    expectedBeforeOpen = statSync(canonicalExpected);
    if (!expectedBeforeOpen.isFile()) throw invalid("Native disk target must be a regular file");
  } catch (error) {
    if (error instanceof NativeDiskApplyError) throw error;
    throw invalid(`Native disk file is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    fd = openSync(canonicalExpected, constants.O_RDWR | constants.O_NOFOLLOW);
  } catch (error) {
    throw invalid(`Native disk file could not be opened: ${error instanceof Error ? error.message : String(error)}`);
  }
  let effectStarted = false;
  let result: NativeDiskApplyResult | undefined;
  let operationError: NativeDiskApplyError | undefined;
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile()) throw invalid("Native disk target must be a regular file");
    if (!sameIdentity(opened, expectedBeforeOpen)) throw invalid("Native disk file identity changed while opening");
    if (opened.size !== expected.byteLength) throw invalid("Native disk expected bytes do not match current file size");
    const observed = readBounded(fd, expected.byteLength);
    if (observed.byteLength !== expected.byteLength || !observed.equals(expected)) throw invalid("Native disk expected bytes do not match current file");

    // These checks are intentionally adjacent to the first effect. They close
    // lexical symlink retargets and path replacement races that can be caught
    // synchronously, while the documentation above records the remaining
    // optimistic race against an unrelated writer.
    assertLexicalTarget(lexicalPath, canonicalExpected, workspaceRoot);
    const current = statSync(canonicalExpected);
    if (!current.isFile() || !sameIdentity(opened, current)) throw invalid("Native disk file identity changed before write");

    effectStarted = true;
    writeAll(fd, content);
    ftruncateSync(fd, content.byteLength);
    fsyncSync(fd);
    const after = fstatSync(fd);
    if (!after.isFile() || after.size !== content.byteLength || !sameIdentity(opened, after)) throw new Error("Native disk file postcondition failed");
    const readback = readBounded(fd, content.byteLength);
    if (readback.byteLength !== content.byteLength || !readback.equals(content)) throw new Error("Native disk readback did not match requested content");
    result = { text: request.content, saved: true, canonicalPath: canonicalExpected };
  } catch (error) {
    const normalized = error instanceof NativeDiskApplyError ? error : new NativeDiskApplyError(
      `Native disk write failed; outcome may have applied; inspect before retrying: ${error instanceof Error ? error.message : String(error)}`,
      { mayHaveApplied: effectStarted, cause: error },
    );
    operationError = normalized.mayHaveApplied || effectStarted ? new NativeDiskApplyError(
      normalized.message.includes("outcome may have applied") ? normalized.message : `${normalized.message}; outcome may have applied; inspect before retrying`,
      { mayHaveApplied: true, cause: normalized },
    ) : normalized;
  } finally {
    try { closeSync(fd); }
    catch (error) {
      if (!operationError && result) operationError = new NativeDiskApplyError(
        `Native disk file close failed; outcome may have applied; inspect before retrying: ${error instanceof Error ? error.message : String(error)}`,
        { mayHaveApplied: true, cause: error },
      );
      else if (!operationError) operationError = invalid(`Native disk file could not be closed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (operationError) throw operationError;
  if (!result) throw new NativeDiskApplyError("Native disk operation returned no result", { mayHaveApplied: effectStarted });
  return result;
}
