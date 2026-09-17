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
// prose/tables must still be hex (abbreviations, ≥7 chars). The expected
// count is the number of rows in the lock table, because the locks that
// actually ship are exactly the ones listed there - padding the file to
// satisfy a fixed number is what this check is meant to prevent.
const lock = readFileSync(join(ROOT, 'docs', 'UPSTREAM-LOCK.md'), 'utf8');
const shas = [...lock.matchAll(/`([0-9a-f]+)`/g)].map((m) => m[1]);
const full = shas.filter((s) => s.length === 40);
const lockRows = lock.split('\n').filter((l) => /^\| [^|]+ \| `[^`]+` \| `[0-9a-f]{40}` \|/.test(l)).length;
check(lockRows >= 3, `upstream lock: want >=3 pinned source rows, got ${lockRows}`);
check(
  full.length >= lockRows,
  `upstream lock: ${lockRows} pinned rows but only ${full.length} full SHAs`,
);
for (const sha of shas) {
  check(/^[0-9a-f]{7,40}$/.test(sha), `upstream lock: non-hex rev ${sha}`);
}

// Documentation links: the README, HANDOFF and the plan are the first thing a
// new session reads, and a link to a file that no longer exists sends it
// nowhere. Superseded plans are deleted rather than archived, so there is no
// exempt tree: every markdown link in this repository must resolve.
// `.commandcode` holds session state written by tooling from the user's own words
// (learned taste, plan drafts). It is not repository documentation: the English-only
// rule below is about what this project publishes, and those files are not ours to
// rewrite. `desktop`/`upstream` are pinned checkouts, `dist`/`out` are build output.
const SKIP_DIRS = new Set(['.git', '.commandcode', 'node_modules', 'desktop', 'upstream', 'dist', 'out']);
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

// English-only and single-owner rules. These are the invariants that keep the
// tree from drifting back into two languages and two plans: without them, a
// `*.th.md` file or a second spec silently recreates the conflict this repo
// just removed. Receipts are JSON, so they are scanned too - Thai text crept
// into receipt bodies historically, not only into markdown.
const evidenceDir = join(ROOT, 'docs', 'maintenance', 'evidence');
const walkAll = (dir, out) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, out);
    else out.push(full);
  }
  return out;
};
const textFiles = [...markdown, ...walkAll(evidenceDir, []).filter((f) => f.endsWith('.json'))];
let thaiFiles = 0;
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8');
  if (/[\u0e00-\u0e7f]/.test(text)) {
    thaiFiles++;
    failures.push(`${relative(ROOT, file)}: contains Thai text; documentation is English-only`);
  }
  if (file.endsWith('.th.md')) {
    failures.push(`${relative(ROOT, file)}: '.th.md' is a retired naming convention`);
  }
}
check(thaiFiles === 0, `docs: ${thaiFiles} file(s) with Thai text`);

// Exactly one spec document, and every evidence receipt must be indexed by it,
// so an unindexed run cannot accumulate where nobody finds it.
const PLAN = join(ROOT, 'docs', 'maintenance', 'CARET-PLAN.md');
check(existsSync(PLAN), 'plan: docs/maintenance/CARET-PLAN.md is missing');
const plan = readFileSync(PLAN, 'utf8');
for (const entry of readdirSync(evidenceDir, { withFileTypes: true })) {
  if (entry.isDirectory() && !plan.includes(entry.name)) {
    failures.push(`evidence/${entry.name}: not indexed in CARET-PLAN.md`);
  }
}
const otherPlans = markdown
  .map((f) => relative(ROOT, f))
  .filter((f) => /(^|\/)(PLAN|SPEC|ROADMAP|PARITY-MATRIX|UI-SPEC)[^/]*\.md$/i.test(f) && f !== 'docs/maintenance/CARET-PLAN.md');
check(
  otherPlans.length === 0,
  `docs: more than one plan/spec document: ${otherPlans.join(', ')}`,
);

if (failures.length > 0) {
  console.error(`CI-FAIL ${failures.length}:\n${failures.map((f) => `- ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`CI-OK parents=198 ui=75 children=${seenChild.size} lock-shas=${shas.length} doc-links=${checkedLinks} md=${markdown.length} evidence=${readdirSync(evidenceDir).length}`);
