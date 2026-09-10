// Fixture forge server (Gitea-shaped REST) for client conformance: repo
// create/read, PR open/read/list/merge with merged-flag transitions,
// 401/404 surfaces. In-memory, ephemeral port. Kept as test harness.
import * as http from "node:http";

interface StubPull {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  mergeable: boolean;
  headRef: string;
  headSha: string;
  baseRef: string;
}

const portIndex = process.argv.indexOf("--port");
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 18931;
const TOKEN = "forge-test-token";

const repos = new Map<string, { defaultBranch: string }>();
const pulls = new Map<string, StubPull[]>();
let counter = 0;

const send = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  if (req.headers["authorization"] !== `token ${TOKEN}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "bad credentials" }));
    return;
  }
  let raw = "";
  req.on("data", (chunk: Buffer) => {
    raw += chunk.toString("utf8");
  });
  req.on("end", () => {
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      send(res, 400, { message: "bad json" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://x");
    const parts = url.pathname.replace(/^\/api\/v1\//, "").split("/");

    if (req.method === "POST" && parts.join("/") === "user/repos") {
      const name = String(body["name"] ?? "");
      if (!name) {
        send(res, 422, { message: "name required" });
        return;
      }
      repos.set(`caret/${name}`, { defaultBranch: "main" });
      send(res, 201, { full_name: `caret/${name}`, clone_url: `http://x/caret/${name}.git`, default_branch: "main" });
      return;
    }

    const repoMatch = parts.length >= 2 && parts[0] === "repos" ? { owner: parts[1], repo: parts[2] } : null;
    if (!repoMatch || !repos.has(`${repoMatch.owner}/${repoMatch.repo}`)) {
      send(res, 404, { message: "repo not found" });
      return;
    }
    const key = `${repoMatch.owner}/${repoMatch.repo}`;
    const rest = parts.slice(3);

    if (req.method === "GET" && rest.length === 0) {
      send(res, 200, { full_name: key, clone_url: `http://x/${key}.git`, default_branch: "main" });
      return;
    }
    if (rest[0] !== "pulls") {
      send(res, 404, { message: "unknown endpoint" });
      return;
    }
    const list = pulls.get(key) ?? [];
    if (req.method === "POST" && rest.length === 1) {
      counter += 1;
      const pull: StubPull = {
        number: counter,
        title: String(body["title"] ?? ""),
        state: "open",
        merged: false,
        mergeable: true,
        headRef: `caret:${String(body["head"] ?? "")}`,
        headSha: `sha${counter}`,
        baseRef: `caret:${String(body["base"] ?? "")}`,
      };
      list.push(pull);
      pulls.set(key, list);
      send(res, 201, {
        number: pull.number,
        title: pull.title,
        state: pull.state,
        merged: pull.merged,
        mergeable: pull.mergeable,
        head: { label: pull.headRef, sha: pull.headSha },
        base: { label: pull.baseRef },
      });
      return;
    }
    if (req.method === "GET" && rest.length === 1) {
      const state = url.searchParams.get("state") ?? "open";
      const filtered = state === "all" ? list : list.filter((p) => p.state === state);
      send(res, 200, filtered.map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        merged: p.merged,
        mergeable: p.mergeable,
        head: { label: p.headRef, sha: p.headSha },
        base: { label: p.baseRef },
      })));
      return;
    }
    const index = Number(rest[1]);
    const pull = list.find((p) => p.number === index);
    if (rest.length >= 2 && !pull) {
      send(res, 404, { message: "pull not found" });
      return;
    }
    if (req.method === "GET" && rest.length === 2 && pull) {
      send(res, 200, {
        number: pull.number,
        title: pull.title,
        state: pull.state,
        merged: pull.merged,
        mergeable: pull.mergeable,
        head: { label: pull.headRef, sha: pull.headSha },
        base: { label: pull.baseRef },
      });
      return;
    }
    if (req.method === "POST" && rest.length === 3 && rest[2] === "merge" && pull) {
      pull.state = "closed";
      pull.merged = true;
      send(res, 200, {});
      return;
    }
    send(res, 404, { message: "unknown endpoint" });
  });
});

server.listen(port, () => {
  console.log(`listening ${port}`);
});
