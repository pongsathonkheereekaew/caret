// Caret ignore matcher (SEARCH-04/05): gitignore-shaped lines. Exclusion
// hides context only — it never grants tool permission (SEARCH-05).
export const parseIgnore = (text: string): ReadonlyArray<string> =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

const globToRegExp = (pattern: string): RegExp => {
  const dirOnly = pattern.endsWith("/");
  const body = dirOnly ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  const anchored = body.startsWith("/") ? `^${escaped.slice(1)}` : `(^|/)${escaped}`;
  return new RegExp(dirOnly ? `${anchored}(/|$)` : `${anchored}(/|$)`);
};

export const isIgnored = (relPath: string, patterns: ReadonlyArray<string>): boolean => {
  const posix = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  let ignored = false;
  for (const raw of patterns) {
    const negate = raw.startsWith("!");
    const pattern = negate ? raw.slice(1) : raw;
    if (globToRegExp(pattern).test(posix)) ignored = !negate;
  }
  return ignored;
};
