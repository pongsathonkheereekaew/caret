import * as Net from "node:net";

/** Shared URL policy for web_fetch and SEARCH-07 docs sources. */
export const refusedHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal") return true;
  if (Net.isIP(host) === 4) {
    const parts = host.split(".").map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (Net.isIP(host) === 6) {
    if (host === "::1" || host.toLowerCase().startsWith("fc") || host.toLowerCase().startsWith("fd")) return true;
  }
  return false;
};

export const assertPublicHttpUrl = (raw: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`bad url ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("http(s) only");
  }
  if (parsed.username || parsed.password || raw.includes("@")) {
    throw new Error("credentials in URL refused");
  }
  if (refusedHost(parsed.hostname)) {
    throw new Error(`host refused ${parsed.hostname}`);
  }
  return parsed;
};
