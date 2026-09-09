# Caret — Upstream Lock Manifest (M0)

Pinned 2026-09-09. Every `HEAD` below is a full SHA observed on that date via
`git ls-remote`; re-pin explicitly before release, never float. Snapshots from
planning research are NOT production locks — this file is the lock (R02).

| Component | Repo | Pinned revision | Role in Caret | License (verify file at use) |
|---|---|---|---|---|
| Code-OSS | `microsoft/vscode` | `3e078a39dc95d262123da38f916225a126fb1ccf` (main HEAD) | Desktop fork base (`desktop/`) | MIT |
| Synara | `Emanuele-web04/synara` | `59db80a170a0abe7c8710ae247f15097ec46cd68` (main HEAD = assessed revision) | UI start + preferred backend candidate (`upstream/synara/`) | MIT (retain T3 Tools Inc. + Emanuele Di Pietro notices) |
| Paseo | `getpaseo/paseo` | `433e67b18b7964a92d593bdc78c518143accfc8b` (main HEAD) | Fallback backend only | Apache-2.0 per LICENSE file w/ third-party exceptions (GitHub metadata says NOASSERTION — check the file, not the metadata) |
| Codex engine | `openai/codex` | `4f2449b4b21988d5015ce6edf755fbd6a37a4908` (HEAD) | Reference driver (official app-server, ChatGPT login) | Apache-2.0 |
| OpenCode engine | `anomalyco/opencode` | `f69beceaffca94bed05a7669af93602125c37248` (HEAD) | Coverage driver first (Go/OpenRouter/DeepSeek via config) | MIT |
| Gitea | `go-gitea/gitea` | `92f2f6161b4c4e5c91c38a3615ce8e5711f9457b` (HEAD, M10 scope) | Origin-equivalent forge service | MIT |

Notes:

- Code-OSS has no usable stable release tag in its tag list (390 tags, newest
  are legacy `0.4x`/tooling tags), so main HEAD is pinned and F01 must verify
  a clean build + launch on each OS family before it becomes the fork base.
- Synara manifests state `0.8.3`; not confirmed as a published stable release.
  Treat as source snapshot, tag Caret releases with their own version support.
- Never mix client/protocol/server revisions across components; handshake
  rejects incompatible major protocol before any mutation (J5).

## Build environment observed 2026-09-09 (this machine)

| Tool | Version | Needed for | Status |
|---|---|---|---|
| node | v26.7.0 | Code-OSS build, Synara server/web | present |
| bun | — | Synara monorepo scripts | MISSING — install at SYN-01 |
| go | — | OpenCode engine, Gitea (M10) | MISSING — install at F03/M10 |
| python3 | 3.9.6 | fixtures/scripts | present (verify version meets needs at use) |
| git | 2.50.1 | all | present |

Missing toolchain installs are explicit prerequisites, not silent skips.
