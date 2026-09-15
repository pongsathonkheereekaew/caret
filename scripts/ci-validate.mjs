// Control-repo CI validator (no deps): requirement graph schema +
// evidence linkage + upstream-lock shape. Fails loud on the breakage
// classes seen in practice (format churn, dangling evidence refs).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const graph = JSON.parse(readFileSync(join(ROOT, 'backlog', 'requirement-graph.json'), 'utf8'));
check(graph.parents?.length === 198, `parents: want 198, got ${graph.parents?.length}`);
check(graph.ui_families?.length === 75, `ui_families: want 75, got ${graph.ui_families?.length}`);

const STATUSES = new Set(['planned', 'implemented', 'verified', 'blocked-external']);
const RESULTS = new Set(['pass', 'fail', 'open', 'blocked']);
const seenChild = new Set();
for (const p of graph.parents) {
  check(typeof p.id === 'string' && p.id.length > 0, 'parent missing id');
  check(STATUSES.has(p.status), `${p.id}: bad status ${p.status}`);
  check(Array.isArray(p.children), `${p.id}: children not an array`);
  let hasPass = false, hasNonPass = false;
  for (const c of p.children ?? []) {
    check(typeof c.id === 'string' && c.id.startsWith(`${p.id}-`), `${p.id}: bad child id ${c.id}`);
    check(!seenChild.has(c.id), `duplicate child id ${c.id}`);
    seenChild.add(c.id);
    check(typeof c.title === 'string' && c.title.length > 0, `${c.id}: missing title`);
    check(typeof c.evidence === 'string' && existsSync(join(ROOT, c.evidence)), `${c.id}: missing evidence ${c.evidence}`);
    check(RESULTS.has(c.result), `${c.id}: bad result ${c.result}`);
    if (c.result === 'pass') hasPass = true; else hasNonPass = true;
  }
  if (p.status === 'verified') {
    check((p.children ?? []).length > 0 && !hasNonPass, `${p.id}: verified without all-pass children`);
  }
}

// Upstream lock: pinned revisions are full 40-hex SHAs; short forms in
// prose/tables must still be hex (abbreviations, ≥7 chars).
const lock = readFileSync(join(ROOT, 'docs', 'UPSTREAM-LOCK.md'), 'utf8');
const shas = [...lock.matchAll(/`([0-9a-f]+)`/g)].map((m) => m[1]);
const full = shas.filter((s) => s.length === 40);
check(full.length >= 6, `upstream lock: want ≥6 full SHAs, got ${full.length}`);
for (const sha of shas) {
  check(/^[0-9a-f]{7,40}$/.test(sha), `upstream lock: non-hex rev ${sha}`);
}

// Documentation links: the README, HANDOFF and the plan are the first thing a
// new session reads, and a link to a file that moved into archive sends it
// nowhere. `docs/archive/**` is exempt on purpose - those snapshots were written
// against other checkouts and docs/archive/README.md records that their dead
// links are historical, not defects.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'desktop', 'upstream', 'dist', 'out', join('docs', 'archive')]);
const walkDocs = (dir, out) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      // Packaged application bundles hold third-party markdown whose links are not
      // this repository's to keep working.
      const packaged = entry.name.endsWith('.app') || entry.name === 'node_modules.asar.unpacked';
      if (!packaged && !SKIP_DIRS.has(entry.name) && !SKIP_DIRS.has(rel)) walkDocs(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
};
const markdown = walkDocs(ROOT, []);
let checkedLinks = 0;
for (const file of markdown) {
  for (const [, href] of readFileSync(file, 'utf8').matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    checkedLinks++;
    const rawTarget = href.split('#')[0];
    // A literal `%` in a path is not percent-encoding and must not throw here.
    let decodedTarget = rawTarget;
    try {
      decodedTarget = decodeURIComponent(rawTarget);
    } catch {
      // keep the raw path
    }
    const target = resolve(dirname(file), decodedTarget);
    check(existsSync(target), `${relative(ROOT, file)}: dead doc link ${href}`);
  }
}
check(checkedLinks > 0, 'doc links: nothing checked');

if (failures.length > 0) {
  console.error(`CI-FAIL ${failures.length}:\n${failures.map((f) => `- ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`CI-OK parents=198 ui=75 children=${seenChild.size} lock-shas=${shas.length} doc-links=${checkedLinks} md=${markdown.length}`);
