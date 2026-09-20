import { describe, expect, test } from "bun:test";
import { parsePairingOffer, pairingSecretKeys, readPairingSecrets, readStoredPairingOffer, revokePairing, savePairingSecrets, type PairingSecretStore } from "../core/pairing.ts";

function memoryStore(): PairingSecretStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, deleteItem: async key => { values.delete(key); } };
}

const offer = {
  v: 2,
  protocolVersion: 1,
  serverId: "mac-1",
  relayEndpoint: "relay.example.test:443",
  relayUseTls: true,
  daemonPublicKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  deviceId: "iphone-1",
  deviceToken: "device-token",
} as const;

describe("private pairing", () => {
  test("parses the relay v2 JSON offer and rejects legacy/plaintext payloads", () => {
    expect(parsePairingOffer(JSON.stringify(offer)).serverId).toBe("mac-1");
    expect(parsePairingOffer(JSON.stringify(offer)).relayEndpoint).toBe("relay.example.test:443");
    expect(() => parsePairingOffer(JSON.stringify({ ...offer, privatePairingKey: "invented" }))).toThrow();
    expect(() => parsePairingOffer(JSON.stringify({ ...offer, relayEndpoint: "wss://relay.example.test:443", relayUseTls: false }))).toThrow();
  });

  test("stores token/key/public key in the secure-store seam only", async () => {
    const store = memoryStore();
    await savePairingSecrets(store, parsePairingOffer(offer));
    const keys = pairingSecretKeys("mac-1");
    expect(store.values.has(keys.token)).toBe(true);
    expect(store.values.has(keys.deviceId)).toBe(true);
    expect(store.values.has(keys.daemonPublicKeyB64)).toBe(true);
    expect(store.values.has(keys.offer)).toBe(true);
    await expect(readPairingSecrets(store, "mac-1")).resolves.toMatchObject({ deviceId: "iphone-1", deviceToken: "device-token", daemonPublicKeyB64: offer.daemonPublicKeyB64 });
    await expect(readStoredPairingOffer(store)).resolves.toEqual(offer);
    await revokePairing(store, "mac-1");
    await expect(readPairingSecrets(store, "mac-1")).resolves.toBeNull();
    await expect(readStoredPairingOffer(store)).resolves.toBeNull();
  });

  test("rejects public-key replacement until the old pairing is revoked", async () => {
    const store = memoryStore();
    await savePairingSecrets(store, parsePairingOffer(offer));
    await expect(savePairingSecrets(store, parsePairingOffer({ ...offer, daemonPublicKeyB64: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=" }))).rejects.toThrow();
  });
});
