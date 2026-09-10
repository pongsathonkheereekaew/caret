// Caret run export bundle (M7 personal-use primitive, M8 handoff reuse):
// portable {handoff + journal tail} assembled from recorded state — never a
// repo restore (raw whole-repo restore stays prohibited). Import surface is
// deliberately narrow: exactly one file, validated shape, no path from data.
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type { RunHandoff } from "./daemon.ts";

/** Journal events kept per bundle (tail). Full history stays in the JSONL. */
export const BUNDLE_JOURNAL_CAP = 500;

export interface RunBundle {
  readonly version: 1;
  readonly exportedAt: string;
  readonly threadId: string;
  readonly goal: string;
  readonly handoff: RunHandoff;
  readonly journal: ReadonlyArray<unknown>;
}

export const BUNDLE_FILENAME = "bundle.json";

export const assembleRunBundle = (params: {
  threadId: string;
  goal: string;
  handoff: RunHandoff;
  journal: ReadonlyArray<unknown>;
}): RunBundle => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  threadId: params.threadId,
  goal: params.goal,
  handoff: params.handoff,
  journal: params.journal.slice(-BUNDLE_JOURNAL_CAP),
});

export const writeRunBundle = (dir: string, bundle: RunBundle, overwrite = false) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(dir, { recursive: true });
    const file = path.join(dir, BUNDLE_FILENAME);
    if (!overwrite && (yield* fs.exists(file))) {
      return yield* Effect.fail(new Error(`refusing to overwrite export: ${file}`));
    }
    yield* fs.writeFileString(file, JSON.stringify(bundle));
    return file;
  });

export const readRunBundle = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const raw = yield* fs.readFileString(path.join(dir, BUNDLE_FILENAME)).pipe(
      Effect.catch(() => Effect.fail(new Error(`no export bundle in ${dir}`))),
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return yield* Effect.fail(new Error(`corrupt export bundle in ${dir}: not JSON`));
    }
    if (typeof parsed !== "object" || parsed === null || (parsed as { version?: unknown }).version !== 1) {
      return yield* Effect.fail(new Error(`corrupt export bundle in ${dir}: version !== 1`));
    }
    const bundle = parsed as {
      threadId?: unknown;
      goal?: unknown;
      handoff?: unknown;
      journal?: unknown;
    };
    if (
      typeof bundle.threadId !== "string" ||
      typeof bundle.goal !== "string" ||
      typeof bundle.handoff !== "object" ||
      bundle.handoff === null ||
      !Array.isArray(bundle.journal)
    ) {
      return yield* Effect.fail(new Error(`corrupt export bundle in ${dir}: missing threadId/goal/handoff/journal`));
    }
    return parsed as unknown as RunBundle;
  });
