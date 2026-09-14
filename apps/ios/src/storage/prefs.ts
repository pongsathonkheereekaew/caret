import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_PRODUCT_PREFS, normalizeProductPrefs, type ProductPrefs } from "../core/product-prefs.ts";

/** Presentation prefs only. Not the snapshot cache and not pairing secrets. */
export const PRODUCT_PREFS_STORAGE_KEY = "caret.mobile.productPrefs.v1";

export async function readStoredProductPrefs(): Promise<ProductPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCT_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRODUCT_PREFS;
    return normalizeProductPrefs(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_PRODUCT_PREFS;
  }
}

export async function writeStoredProductPrefs(prefs: ProductPrefs): Promise<void> {
  await AsyncStorage.setItem(PRODUCT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}
