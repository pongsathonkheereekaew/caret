import { buildFileIndex, clipForEmbed, rankIndex, type Embedder, type FileIndex } from "./search-index.ts";
import type { RankedDoc } from "./semantic.ts";

export type IndexPhase = "idle" | "scanning" | "embedding" | "ready" | "paused" | "failed";

export interface IndexStatus {
  readonly root: string;
  readonly phase: IndexPhase;
  readonly filesDone: number;
  readonly filesTotal: number;
  readonly chunksDone: number;
  readonly chunksTotal: number;
  readonly generation: number;
  readonly error?: string;
}

export interface IndexSnapshot {
  readonly index: FileIndex;
  readonly vectors: ReadonlyArray<ReadonlyArray<number>>;
}

export class IndexJob {
  private generation = 0;
  private paused = false;
  private running: Promise<IndexStatus> | null = null;
  private snapshot: IndexSnapshot | null = null;
  private state: IndexStatus;

  constructor(
    readonly root: string,
    private readonly scan: () => Promise<ReadonlyArray<{ path: string; text: string }>>,
    private readonly embedder: Embedder,
    private readonly onProgress: (status: IndexStatus) => void = () => {},
  ) {
    this.state = this.makeStatus("idle");
  }

  status(): IndexStatus {
    return { ...this.state };
  }

  pause(): IndexStatus {
    this.paused = true;
    this.state = this.makeStatus("paused", this.state);
    this.emit();
    return this.status();
  }

  resume(): Promise<IndexStatus> {
    this.paused = false;
    return this.rebuild();
  }

  rebuild(): Promise<IndexStatus> {
    if (this.running) return this.running;
    this.paused = false;
    const generation = ++this.generation;
    this.running = this.run(generation).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async search(query: string, k: number): Promise<RankedDoc[]> {
    if (!this.snapshot || this.state.phase !== "ready") {
      throw new Error(`index not ready (${this.state.phase})`);
    }
    const queryVector = await this.embedder.embed(clipForEmbed(query, "query"), "query");
    return rankIndex(this.snapshot.index, queryVector, this.snapshot.vectors, k);
  }

  private async run(generation: number): Promise<IndexStatus> {
    try {
      this.state = this.makeStatus("scanning", { generation });
      this.emit();
      const files = await this.scan();
      if (this.paused || generation !== this.generation) return this.pause();

      const index = buildFileIndex(files, 900, 100);
      this.state = this.makeStatus("embedding", {
        generation,
        filesDone: files.length,
        filesTotal: files.length,
        chunksTotal: index.chunks.length,
      });
      this.emit();

      const vectors: number[][] = [];
      for (const chunk of index.chunks) {
        if (this.paused || generation !== this.generation) return this.pause();
        vectors.push(await this.embedder.embed(clipForEmbed(chunk.text, "document"), "document"));
        this.state = this.makeStatus("embedding", {
          ...this.state,
          chunksDone: vectors.length,
        });
        this.emit();
      }
      this.snapshot = { index, vectors };
      this.state = this.makeStatus("ready", {
        ...this.state,
        chunksDone: vectors.length,
      });
      this.emit();
      return this.status();
    } catch (error) {
      this.state = this.makeStatus("failed", {
        generation,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit();
      return this.status();
    }
  }

  private makeStatus(phase: IndexPhase, patch: Partial<IndexStatus> = {}): IndexStatus {
    return {
      root: this.root,
      filesDone: 0,
      filesTotal: 0,
      chunksDone: 0,
      chunksTotal: 0,
      generation: this.generation,
      ...patch,
      phase,
    };
  }

  private emit(): void {
    this.onProgress(this.status());
  }
}
