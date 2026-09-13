import * as SecureStore from "expo-secure-store";
import type { PairingSecretStore } from "../core/pairing.ts";

/** Native credentials store. AsyncStorage is intentionally never used here. */
export const securePairingStore: PairingSecretStore = {
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  deleteItem: key => SecureStore.deleteItemAsync(key),
};
