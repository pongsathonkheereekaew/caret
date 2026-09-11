import { describe, expect, it } from "vitest";
import { IndexJob } from "./index-job.ts";

const embedder = {
  async embed(text: string): Promise<number[]> {
    return text.includes("alpha") ? [1, 0] : [0, 1];
  },
};

describe("IndexJob", () => {
  it("reports bounded phases, caches vectors, and searches", async () => {
    const phases: string[] = [];
    const job = new IndexJob(
      "/repo",
      async () => [
        { path: "alpha.ts", text: "export const alpha = 1" },
        { path: "beta.ts", text: "export const beta = 2" },
      ],
      embedder,
      (status) => phases.push(status.phase),
    );
    const done = await job.rebuild();
    expect(done).toMatchObject({
      phase: "ready",
      filesDone: 2,
      filesTotal: 2,
      chunksDone: 2,
      chunksTotal: 2,
    });
    expect(phases[0]).toBe("scanning");
    expect(phases.at(-1)).toBe("ready");
    expect((await job.search("alpha", 2))[0]?.id).toBe("alpha.ts");
    expect(done.failures).toEqual([]);
  });

  it("keeps ready when some files fail", async () => {
    const job = new IndexJob(
      "/repo",
      async () => ({
        files: [{ path: "ok.ts", text: "alpha" }],
        failures: [{ path: "big.ts", reason: "too-large" }],
      }),
      embedder,
    );
    await expect(job.rebuild()).resolves.toMatchObject({
      phase: "ready",
      filesDone: 1,
      failures: [{ path: "big.ts", reason: "too-large" }],
    });
  });

  it("deduplicates rebuilds and reaches a terminal failure", async () => {
    let scans = 0;
    const job = new IndexJob(
      "/broken",
      async () => {
        scans += 1;
        throw new Error("root unreadable");
      },
      embedder,
    );
    const a = job.rebuild();
    const b = job.rebuild();
    expect(a).toBe(b);
    await expect(a).resolves.toMatchObject({ phase: "failed", error: "root unreadable" });
    expect(scans).toBe(1);
  });

  it("pauses during embedding and resumes with a new generation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    const slow = {
      async embed(text: string): Promise<number[]> {
        if (first) {
          first = false;
          await gate;
        }
        return embedder.embed(text);
      },
    };
    const job = new IndexJob(
      "/repo",
      async () => [
        { path: "a.ts", text: "alpha" },
        { path: "b.ts", text: "beta" },
      ],
      slow,
    );
    const building = job.rebuild();
    await Promise.resolve();
    await Promise.resolve();
    expect(job.pause().phase).toBe("paused");
    release();
    await expect(building).resolves.toMatchObject({ phase: "paused" });
    await expect(job.resume()).resolves.toMatchObject({ phase: "ready", generation: 2 });
  });
});
