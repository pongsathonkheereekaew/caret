// Fixture hosted daemon (test harness): prints one remote.ready line
// with its bound port, then idles until killed. Speaks nothing else.
import * as Net from "node:net";

const port = Number(process.env["CARET_PORT"] ?? 0);
const server = Net.createServer(() => {});
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const bound = typeof address === "object" && address !== null ? address.port : 0;
  console.log(JSON.stringify({ event: "remote.ready", host: "127.0.0.1", port: bound, pairingFile: null }));
});
setInterval(() => {}, 10000);
