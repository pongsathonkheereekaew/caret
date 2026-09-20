import type { CediaProviderAuthApi } from "../../../../../../../../../packages/protocol/src/provider-auth.ts";
export type { ProviderAuthStatus, ProviderLoginAttempt } from "../../../../../../../../../packages/protocol/src/provider-auth.ts";

let api: CediaProviderAuthApi | undefined;
export function installCediaProviderAuthApi(value: CediaProviderAuthApi): void { api = value; }
export function getCediaProviderAuthApi(): CediaProviderAuthApi {
  if (!api) throw new Error("Provider settings require the Cedia host");
  return api;
}
