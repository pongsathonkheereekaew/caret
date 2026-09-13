/** Trusted OMP extension: the execution process itself retains the session lock. */
import { DatabaseSync } from "node:sqlite";
import { chmodSync, closeSync, openSync } from "node:fs";

let owner: DatabaseSync | undefined;
export default function lockOmpSession(): void {
  const path = process.env.CARET_SESSION_LOCK;
  if (!path) {
    process.stderr.write("Caret requires a session ownership lock\n");
    process.exit(73);
  }
  try {
    closeSync(openSync(path, "a", 0o600));
    chmodSync(path, 0o600);
    owner = new DatabaseSync(path);
    owner.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE");
  } catch {
    process.stderr.write("Caret session is still owned by another OMP process\n");
    process.exit(73);
  }
  process.once("exit", () => { try { owner?.close(); } catch { /* OS also releases the lock. */ } });
}
