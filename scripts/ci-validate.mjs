// Control-repo CI validator (no deps): requirement graph schema +
// evidence linkage + upstream-lock shape. Fails loud on the breakage
// classes seen in practice (format churn, dangling evidence refs).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

if (failures.length > 0) {
  console.error(`CI-FAIL ${failures.length}:\n${failures.map((f) => `- ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`CI-OK parents=198 ui=75 children=${seenChild.size} lock-shas=${shas.length}`);
