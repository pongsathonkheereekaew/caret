// Caret forge client (M10 seed, M7 PR integration): Gitea REST over owned
// fetch wire, no SDK — same posture as the MCP clients. Covers the sync
// matrix kernel: repo create/read, PR open/read/merge, PR listing. Tokens
// ride the Authorization header; 401/404/422 surface as ForgeError with
// the server message (never silent).
export class ForgeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ForgeError";
  }
}

export interface ForgeRepo {
  readonly fullName: string;
  readonly cloneUrl: string;
  readonly defaultBranch: string;
}

export interface ForgePull {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly merged: boolean;
  readonly mergeable: boolean;
  readonly headRef: string;
  readonly headSha: string;
  readonly baseRef: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export class GiteaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs = 15000,
  ) {}

  async createRepo(name: string, opts: { private?: boolean } = {}): Promise<ForgeRepo> {
    const body = (await this.call("POST", "/user/repos", {
      name,
      private: opts.private ?? false,
      auto_init: false,
    })) as Record<string, unknown>;
    return this.repoOf(body);
  }

  async getRepo(owner: string, repo: string): Promise<ForgeRepo> {
    return this.repoOf((await this.call("GET", `/repos/${owner}/${repo}`)) as Record<string, unknown>);
  }

  async createPull(
    owner: string,
    repo: string,
    pull: { title: string; head: string; base: string; body?: string },
  ): Promise<ForgePull> {
    return this.pullOf(
      (await this.call("POST", `/repos/${owner}/${repo}/pulls`, {
        title: pull.title,
        head: pull.head,
        base: pull.base,
        body: pull.body ?? "",
      })) as Record<string, unknown>,
    );
  }

  async getPull(owner: string, repo: string, index: number): Promise<ForgePull> {
    return this.pullOf(
      (await this.call("GET", `/repos/${owner}/${repo}/pulls/${index}`)) as Record<string, unknown>,
    );
  }

  async listPulls(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<ForgePull[]> {
    const body = (await this.call("GET", `/repos/${owner}/${repo}/pulls?state=${state}`)) as unknown;
    if (!Array.isArray(body)) {
      throw new ForgeError("pull list returned no array");
    }
    return body.map((entry) => this.pullOf(entry as Record<string, unknown>));
  }

  /** Merge, then re-read: the merged flag on GET is the proof, not the merge echo. */
  async mergePull(owner: string, repo: string, index: number): Promise<ForgePull> {
    await this.call("POST", `/repos/${owner}/${repo}/pulls/${index}/merge`, { Do: "merge" });
    const merged = await this.getPull(owner, repo, index);
    if (!merged.merged) {
      throw new ForgeError(`pull ${index} merge call ok but merged flag false`);
    }
    return merged;
  }

  private repoOf(body: Record<string, unknown>): ForgeRepo {
    if (typeof body["full_name"] !== "string") {
      throw new ForgeError("repo response missing full_name");
    }
    return {
      fullName: body["full_name"],
      cloneUrl: typeof body["clone_url"] === "string" ? body["clone_url"] : "",
      defaultBranch: typeof body["default_branch"] === "string" ? body["default_branch"] : "main",
    };
  }

  private pullOf(body: Record<string, unknown>): ForgePull {
    const head = asRecord(body["head"]);
    const base = asRecord(body["base"]);
    if (typeof body["number"] !== "number") {
      throw new ForgeError("pull response missing number");
    }
    return {
      number: body["number"],
      title: typeof body["title"] === "string" ? body["title"] : "",
      state: typeof body["state"] === "string" ? body["state"] : "unknown",
      merged: body["merged"] === true,
      mergeable: body["mergeable"] === true,
      headRef: typeof head["label"] === "string" ? head["label"] : String(head["ref"] ?? ""),
      headSha: typeof head["sha"] === "string" ? head["sha"] : "",
      baseRef: typeof base["label"] === "string" ? base["label"] : String(base["ref"] ?? ""),
    };
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `token ${this.token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        // Non-JSON error pages stay text.
      }
      if (res.status === 401) {
        throw new ForgeError(`forge: unauthorized (${this.serverMessage(parsed)})`, 401);
      }
      if (res.status === 404) {
        throw new ForgeError(`forge: not found ${path} (${this.serverMessage(parsed)})`, 404);
      }
      if (res.status < 200 || res.status >= 300) {
        throw new ForgeError(`forge: ${method} ${path} → HTTP ${res.status} (${this.serverMessage(parsed)})`, res.status);
      }
      return parsed;
    } catch (error) {
      if (error instanceof ForgeError) throw error;
      throw new ForgeError(`forge: ${method} ${path} timed out after ${this.timeoutMs}ms`);
    } finally {
      clearTimeout(timer);
    }
  }

  private serverMessage(parsed: unknown): string {
    const message = asRecord(parsed)["message"];
    return typeof message === "string" && message.length > 0 ? message : "no detail";
  }
}
