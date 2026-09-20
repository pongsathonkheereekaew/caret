#!/bin/bash
set -euo pipefail
evidence_dir="$(cd "$(dirname "$0")" && pwd)"
repo_dir="${1:-$(cd "$evidence_dir/../../../.." && pwd)}"
probe_dir="$(mktemp -d "${TMPDIR:-/tmp}/caret-remote-evidence.XXXXXX")"
trap 'rm -rf "$probe_dir"' EXIT
mkdir -p "$probe_dir/apps/caret-daemon/src"
git -C "$repo_dir" show 76f859d60f661039ef9bf2de4c95e36c9b163141:apps/caret-daemon/src/remote.ts > "$probe_dir/apps/caret-daemon/src/remote.ts"
cp "$evidence_dir/probe.ts" "$probe_dir/probe.ts"
bun --version
shasum -a 256 "$probe_dir/apps/caret-daemon/src/remote.ts"
bun run "$probe_dir/probe.ts"
