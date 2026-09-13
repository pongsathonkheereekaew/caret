import {
  validateCaretRelayPairingOffer,
  type CaretRelayPairingOffer,
} from "../../../../packages/relay/src/index.ts";
import { isRecord, nonEmptyString } from "./types.ts";

/** Pairing payload is kept in lockstep with the relay's v2 contract. */
export type PairingOffer = CaretRelayPairingOffer;

export class PairingOfferError extends Error {
  readonly code = "invalid-pairing-offer";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause;
    this.name = "PairingOfferError";
  }
}

export interface PairingSecretStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem?(key: string): Promise<void>;
}

export interface StoredPairingSecrets {
  readonly serverId: string;
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly daemonPublicKeyB64: string;
}

const SECRET_PREFIX = "caret.pairing.v2";
const CURRENT_SERVER_KEY = `${SECRET_PREFIX}.current-server`;

function secretKey(serverId: string, field: string): string {
  return `${SECRET_PREFIX}.${encodeURIComponent(serverId)}.${field}`;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - value.length % 4) % 4), "=");
  try {
    if (typeof globalThis.atob === "function") {
      const binary = globalThis.atob(normalized);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    const buffer = (globalThis as typeof globalThis & { Buffer?: { from(value: string, encoding: string): { toString(encoding: string): string } } }).Buffer;
    if (buffer) return buffer.from(normalized, "base64").toString("utf8");
  } catch (error) {
    throw new PairingOfferError("Pairing offer QR payload is not valid UTF-8", { cause: error });
  }
  throw new PairingOfferError("This device cannot decode a pairing QR payload");
}

function parseCandidate(value: unknown): PairingOffer {
  if (!isRecord(value)) throw new PairingOfferError("Pairing offer must be a JSON object");
  try {
    return validateCaretRelayPairingOffer(value);
  } catch (error) {
    if (error instanceof PairingOfferError) throw error;
    throw new PairingOfferError(error instanceof Error ? error.message : String(error), { cause: error });
  }
}

/** Parse private JSON, or a QR URL carrying #offer=<base64url JSON>. */
export function parsePairingOffer(input: string | unknown): PairingOffer {
  if (typeof input === "object") return parseCandidate(input);
  if (typeof input !== "string" || !input.trim()) throw new PairingOfferError("Pairing offer is empty");
  const raw = input.trim();
  let json = raw;
  const marker = raw.indexOf("#offer=");
  if (marker >= 0) {
    const encoded = raw.slice(marker + "#offer=".length).split(/[&#]/, 1)[0]?.trim();
    if (!encoded) throw new PairingOfferError("Pairing offer QR payload is empty");
    json = decodeBase64Url(encoded);
  }
  try { return parseCandidate(JSON.parse(json) as unknown); } catch (error) {
    if (error instanceof PairingOfferError) throw error;
    throw new PairingOfferError("Pairing offer JSON is invalid");
  }
}

export function pairingSecretKeys(serverId: string): { token: string; deviceId: string; daemonPublicKeyB64: string; offer: string } {
  if (!nonEmptyString(serverId)) throw new TypeError("serverId is required");
  return {
    token: secretKey(serverId, "device-token"),
    deviceId: secretKey(serverId, "device-id"),
    daemonPublicKeyB64: secretKey(serverId, "daemon-public-key"),
    offer: secretKey(serverId, "offer"),
  };
}

/** Store credentials only through SecureStore-backed PairingSecretStore. */
export async function savePairingSecrets(store: PairingSecretStore, offer: PairingOffer): Promise<StoredPairingSecrets> {
  const validated = parseCandidate(offer);
  const keys = pairingSecretKeys(validated.serverId);
  const [existingPublicKey, existingDeviceId] = await Promise.all([store.getItem(keys.daemonPublicKeyB64), store.getItem(keys.deviceId)]);
  if (existingPublicKey && existingPublicKey !== validated.daemonPublicKeyB64) throw new PairingOfferError("The Mac public key changed; revoke the old pairing before importing this offer");
  if (existingDeviceId && existingDeviceId !== validated.deviceId) throw new PairingOfferError("This server already has a different paired device; revoke it before importing this offer");
  await Promise.all([
    store.setItem(keys.token, validated.deviceToken),
    store.setItem(keys.deviceId, validated.deviceId),
    store.setItem(keys.daemonPublicKeyB64, validated.daemonPublicKeyB64),
    store.setItem(keys.offer, JSON.stringify(validated)),
    store.setItem(CURRENT_SERVER_KEY, validated.serverId),
  ]);
  return { serverId: validated.serverId, deviceId: validated.deviceId, deviceToken: validated.deviceToken, daemonPublicKeyB64: validated.daemonPublicKeyB64 };
}

/** Recover the last pairing offer so the app can reconnect after relaunch. */
export async function readStoredPairingOffer(store: PairingSecretStore): Promise<PairingOffer | null> {
  const serverId = await store.getItem(CURRENT_SERVER_KEY);
  if (!serverId) return null;
  const keys = pairingSecretKeys(serverId);
  const raw = await store.getItem(keys.offer);
  if (!raw) return null;
  try {
    return parsePairingOffer(raw);
  } catch {
    return null;
  }
}

export async function readPairingSecrets(store: PairingSecretStore, serverId: string): Promise<StoredPairingSecrets | null> {
  const keys = pairingSecretKeys(serverId);
  const [deviceToken, deviceId, daemonPublicKeyB64] = await Promise.all([store.getItem(keys.token), store.getItem(keys.deviceId), store.getItem(keys.daemonPublicKeyB64)]);
  if (!deviceToken || !deviceId || !daemonPublicKeyB64) return null;
  return { serverId, deviceId, deviceToken, daemonPublicKeyB64 };
}

export async function revokePairing(store: PairingSecretStore, serverId: string): Promise<void> {
  const keys = pairingSecretKeys(serverId);
  if (!store.deleteItem) return;
  await Promise.all([store.deleteItem(keys.token), store.deleteItem(keys.deviceId), store.deleteItem(keys.daemonPublicKeyB64), store.deleteItem(keys.offer)]);
  if ((await store.getItem(CURRENT_SERVER_KEY)) === serverId) await store.deleteItem(CURRENT_SERVER_KEY);
}
