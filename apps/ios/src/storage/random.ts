import { getRandomValues as expoGetRandomValues, randomUUID as expoRandomUUID } from "expo-crypto";

interface SecureCryptoLike {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
}

/** Install Expo's native CSPRNG for tweetnacl when Hermes has no Web Crypto. */
export function installSecureRandom(): void {
  const globalObject = globalThis as unknown as { crypto?: SecureCryptoLike };
  const current = globalObject.crypto;
  if (current?.getRandomValues && current.randomUUID) return;
  const getRandomValues = (array: Uint8Array): Uint8Array => expoGetRandomValues(array);
  const randomUUID = current?.randomUUID ?? expoRandomUUID;
  if (current) {
    try {
      if (!current.getRandomValues) Object.defineProperty(current, "getRandomValues", { value: getRandomValues, configurable: true });
      if (!current.randomUUID) Object.defineProperty(current, "randomUUID", { value: randomUUID, configurable: true });
      return;
    } catch {
      // Some runtimes expose a frozen `crypto`; define a replacement below.
    }
  }
  try {
    Object.defineProperty(globalObject, "crypto", { value: { ...(current ?? {}), getRandomValues, randomUUID }, configurable: true });
  } catch {
    // The relay will report a clear missing-PRNG error if the host forbids a shim.
  }
}
