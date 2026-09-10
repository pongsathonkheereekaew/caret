// Caret session process host (parallel-sessions answer): one daemon
// process per live session, each with its own adapter, queue, port, and
// pairing token — competing-consumer corruption is structurally
// impossible (no shared stream, no upstream touch). Plain async class in
// the McpClient style; callers address sessions by endpoint+token (the
// existing CaretClient and CLI already take both per instance).
import * as cp from "node:child_process";
import * as Crypto from "node:crypto";

export interface HostedSession {
  readonly id: string;
  readonly repoDir: string;
  readonly runId: string;
  readonly host: string;
  readonly port: number;
  readonly token: string;
  readonly pid: number | undefined;
  readonly startedAt: string;
}

export class HostError extends Error {}

export interface HostLauncher {
  command: string;
  args: ReadonlyArray<string>;
  cwd: string;
  extraEnv?: Record<string, string>;
  /** Where per-session journals land. Defaults to the OS tmp dir. */
  journalDir?: string;
}

const waitReady = (proc: cp.ChildProcess, timeoutMs: number): Promise<{ host: string; port: number }> =>
  new Promise((resolve, reject) => {
    let logs = "";
    const timer = setTimeout(() => reject(new Error("daemon never became ready")), timeoutMs);
    const onData = (chunk: Buffer) => {
      logs += chunk.toString("utf8");
      const line = logs.split("\n").find((entry) => entry.includes("remote.ready"));
      if (line) {
        clearTimeout(timer);
        try {
          const ready = JSON.parse(line) as { host?: unknown; port?: unknown };
          if (typeof ready.host === "string" && typeof ready.port === "number") {
            resolve({ host: ready.host, port: ready.port });
            return;
          }
        } catch {
          // Keep waiting for a parseable line.
        }
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`daemon exited during startup (code ${code}): ${logs.slice(-500)}`));
    });
  });

export class ProcessHost {
  private readonly live = new Map<string, { session: HostedSession; proc: cp.ChildProcess }>();

  constructor(
    private readonly launcher: HostLauncher,
    private readonly readyTimeoutMs = 90000,
  ) {}

  /** Spawn one daemon for a session. Ids starting with the runId stay human-greppable. */
  async spawn(repoDir: string, runId: string): Promise<HostedSession> {
    const id = `${runId}-${Date.now().toString(36)}`;
    if (this.live.has(id)) {
      throw new HostError(`session ${id} already hosted`);
    }
    const token = Crypto.randomBytes(32).toString("hex");
    const journalDir = this.launcher.journalDir ?? "/tmp";
    const proc = cp.spawn(this.launcher.command, [...this.launcher.args], {
      cwd: this.launcher.cwd,
      env: {
        ...process.env,
        ...this.launcher.extraEnv,
        CARET_PAIRING: token,
        CARET_JOURNAL: `${journalDir}/${id}.jsonl`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const ready = await waitReady(proc, this.readyTimeoutMs);
      const session: HostedSession = {
        id,
        repoDir,
        runId,
        host: ready.host,
        port: ready.port,
        token,
        pid: proc.pid,
        startedAt: new Date().toISOString(),
      };
      this.live.set(id, { session, proc });
      return session;
    } catch (error) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Already gone.
      }
      throw error;
    }
  }

  list(): HostedSession[] {
    return [...this.live.values()].map((entry) => entry.session);
  }

  /** Stop one session: SIGTERM, brief grace, then dead entry or loud failure. */
  async stop(id: string, graceMs = 5000): Promise<void> {
    const entry = this.live.get(id);
    if (!entry) throw new HostError(`unknown session ${id}`);
    const { proc } = entry;
    const exited = new Promise<void>((resolve) => {
      proc.on("exit", () => resolve());
      setTimeout(resolve, graceMs);
    });
    try {
      proc.kill("SIGTERM");
    } catch {
      // Already gone; fall through to cleanup.
    }
    await exited;
    try {
      proc.kill("SIGKILL");
    } catch {
      // Exited during grace.
    }
    this.live.delete(id);
  }

  async shutdownAll(): Promise<void> {
    for (const id of [...this.live.keys()]) {
      await this.stop(id).catch(() => {});
    }
  }
}
