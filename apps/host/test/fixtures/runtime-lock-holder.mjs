import lockOmpSession from "../../src/runtime-lock.ts";

lockOmpSession();
process.stdout.write("LOCKED\n");
setInterval(() => {}, 1_000);
