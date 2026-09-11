import * as fs from "node:fs";
import * as path from "node:path";

/** Symlink-stable root identity for index job keys (SEARCH-06). */
export const canonRoot = (root: string): string => {
  try {
    return fs.realpathSync(root);
  } catch {
    return path.resolve(root);
  }
};
