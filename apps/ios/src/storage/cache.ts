import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SnapshotCache } from "../core/replay.ts";

/** Only snapshots/cursors belong in AsyncStorage; credentials use SecureStore. */
export const taskSnapshotCache: SnapshotCache = {
  get: key => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: key => AsyncStorage.removeItem(key),
};
