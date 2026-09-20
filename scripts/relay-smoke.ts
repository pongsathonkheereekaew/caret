/** Synthetic-only hosted interop. Never reads host credentials, projects or model configuration. */
import { randomUUID, randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import { CediaRelayServer } from "../packages/relay/src/server.ts";
import { CediaRelayClient, createCediaRelayPairingOffer, generateKeyPair, exportPublicKey } from "../packages/relay/src/index.ts";
import type { CediaRelaySocket } from "../packages/relay/src/transport.ts";

const key = generateKeyPair();
const token = randomBytes(32).toString("base64url");
const offer = createCediaRelayPairingOffer({ serverId: randomUUID(), daemonPublicKeyB64: exportPublicKey(key.publicKey), relayEndpoint: "relay.paseo.sh:443", relayUseTls: true, deviceId: "synthetic-interop", deviceToken: token });
let revoked = false;
let effects = 0;
const server = new CediaRelayServer({ endpoint: offer.relayEndpoint, useTls: true, serverId: offer.serverId, daemonKeyPair: key, autoReconnect: false,
  authorize: candidate => !revoked && candidate === token,
  handler: async request => {
    if (request.path !== "/fixture") return { status: 404, body: null };
    if (request.method === "POST") effects++;
    return { status: 200, body: { fixture: "cedia-synthetic-interop", effects } };
  },
});
const client = new CediaRelayClient({ offer, createWebSocket: url => new WebSocket(url) as unknown as CediaRelaySocket, requestTimeoutMs: 10_000 });
const timer = setTimeout(() => { client.close(); void server.stop(); process.exitCode = 1; }, 30_000);
try {
  await server.start(); await client.connect();
  const first = await client.request({ method: "POST", path: "/fixture", requestId: "same-id" });
  const duplicate = await client.request({ method: "POST", path: "/fixture", requestId: "same-id" });
  if (first.status !== 200 || duplicate.status !== 200 || effects !== 1) throw new Error("Hosted duplicate handling failed");
  revoked = true;
  const denied = await client.request({ method: "POST", path: "/fixture", requestId: "same-id" });
  if (denied.status !== 401 || effects !== 1) throw new Error("Hosted revoke gate failed");
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), endpoint: offer.relayEndpoint, syntheticOnly: true, encryptedRoundtrip: true, sameIdEffects: effects, revokedCachedReplyStatus: denied.status, realIPhone: false }));
} finally { clearTimeout(timer); client.close(); await server.stop(); }
