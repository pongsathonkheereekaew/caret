import { randomUUID } from 'node:crypto';
import { OmpRpcClient } from '../../../packages/omp-adapter/src/client.ts';
import type { OmpFrame, OmpRpcClientStartOptions } from '../../../packages/omp-adapter/src/types.ts';
import type { ProviderAuthStatus, ProviderLoginAttempt } from '../../../packages/protocol/src/provider-auth.ts';
import { metadataArgs, type OmpModelCatalogOptions } from './model-catalog.ts';

export class ProviderAuthError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

const AUTH_METHODS = new Set(['oauth', 'api_key']);
const CREDENTIAL_KINDS = new Set(['oauth', 'api_key']);
const AUTH_ORIGINS = new Set(['runtime', 'config', 'oauth', 'api_key', 'env', 'fallback']);

/**
 * OMP client failures that are safe to show and useful to act on.
 *
 * Everything else is replaced, because an arbitrary child-process error can
 * carry a runtime path or a credential fragment and this response reaches a
 * remote device.
 */
const SAFE_OMP_FAILURES: readonly string[] = [
  'This OMP runtime does not advertise the Cedia provider-auth bridge',
];
export function describeAuthFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (SAFE_OMP_FAILURES.includes(message) || message.startsWith('Unknown OAuth provider:')) return message;
  return 'OMP could not complete the provider-auth request. Retry, or run OMP in a terminal for this provider.';
}

function strings(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) if (typeof entry === 'string' && allowed.has(entry) && !out.includes(entry)) out.push(entry);
  return out;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 512 ? value.trim() : undefined;
}

/**
 * Trust-boundary projection of OMP's auth rows.
 *
 * These arrive from another process, so every field is checked and an
 * unrecognizable row is dropped rather than forwarded: a malformed row must
 * not become a settings control that writes to an unexpected provider. There
 * is deliberately no field here for credential material to arrive in.
 */
export function normalizeAuthProviders(value: unknown): { providers: ProviderAuthStatus[] } {
  const rows = (value as { providers?: unknown } | null | undefined)?.providers;
  if (!Array.isArray(rows)) throw new ProviderAuthError('OMP did not return a provider list', 502);
  const providers: ProviderAuthStatus[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const candidate = row as Record<string, unknown>;
    const id = optionalString(candidate.id);
    const name = optionalString(candidate.name);
    if (id === undefined || name === undefined) continue;
    const methods = strings(candidate.methods, AUTH_METHODS);
    // A row with nothing to do is not a control, so it is not forwarded.
    if (methods.length === 0) continue;
    const origin = optionalString(candidate.origin);
    const envVar = optionalString(candidate.envVar);
    const storeCredentialsAs = optionalString(candidate.storeCredentialsAs);
    providers.push({
      id,
      name,
      methods: methods as ProviderAuthStatus['methods'],
      available: candidate.available !== false,
      authenticated: candidate.authenticated === true,
      credentialKinds: strings(candidate.credentialKinds, CREDENTIAL_KINDS) as ProviderAuthStatus['credentialKinds'],
      ...(origin !== undefined && AUTH_ORIGINS.has(origin) ? { origin: origin as NonNullable<ProviderAuthStatus['origin']> } : {}),
      ...(envVar === undefined ? {} : { envVar }),
      ...(storeCredentialsAs === undefined ? {} : { storeCredentialsAs }),
    });
  }
  return { providers };
}

type AuthClient = Pick<OmpRpcClient, 'request' | 'requestCedia' | 'send' | 'close' | 'readyFrame'>;

/**
 * OMP's stock OAuth provider list, without the Cedia bridge.
 *
 * `get_login_providers` predates the bridge and is what a stock runtime
 * answers, so sign-in keeps working there; what the bridge adds is the key and
 * credential detail behind each row.
 */
function stockLoginProviders(value: unknown): { providers: ProviderAuthStatus[] } {
  const rows = (value as { providers?: unknown } | null | undefined)?.providers;
  if (!Array.isArray(rows)) throw new ProviderAuthError('OMP did not return a provider list', 502);
  const providers: ProviderAuthStatus[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const candidate = row as Record<string, unknown>;
    const id = optionalString(candidate.id);
    const name = optionalString(candidate.name);
    if (id === undefined || name === undefined) continue;
    if (candidate.available === false) continue;
    providers.push({
      id,
      name,
      methods: ['oauth'],
      available: true,
      authenticated: candidate.authenticated === true,
      credentialKinds: [],
    });
  }
  return { providers };
}
interface AuthOptions extends OmpModelCatalogOptions {
  start?: (options: OmpRpcClientStartOptions) => Promise<AuthClient>;
  onChanged?: () => void;
}
interface Login {
  state: ProviderLoginAttempt;
  client?: AuthClient;
  completion?: Promise<void>;
}

/** Short-lived OMP metadata/auth workers. No task, transcript, or credentials are owned here. */
export class ProviderAuthManager {
  readonly #options: AuthOptions;
  readonly #logins = new Map<string, Login>();
  readonly #clients = new Set<AuthClient>();
  #busy = false;
  #closed = false;

  constructor(options: AuthOptions = {}) { this.#options = options; }

  async #start(onFrame?: (frame: OmpFrame) => void): Promise<AuthClient> {
    if (this.#closed) throw new ProviderAuthError('Provider settings are shutting down');
    const cwd = this.#options.cwd ?? process.cwd();
    const client = await (this.#options.start ?? OmpRpcClient.start)({
      executable: this.#options.ompExecutable,
      env: this.#options.ompEnv,
      cwd,
      args: metadataArgs(this.#options, cwd),
      readyTimeoutMs: 20_000,
      requestTimeoutMs: 30_000,
      onFrame,
    });
    if (this.#closed) { await client.close(); throw new ProviderAuthError('Provider settings are shutting down'); }
    this.#clients.add(client);
    return client;
  }

  async #release(client: AuthClient): Promise<void> {
    await client.close().catch(() => undefined);
    this.#clients.delete(client);
  }

  async list(): Promise<{ providers: ProviderAuthStatus[] }> {
    const client = await this.#start();
    try {
      if (client.readyFrame?.cediaAuthVersion !== 1) {
        const ack = await client.request('get_login_providers', {});
        return stockLoginProviders(ack.data);
      }
      const result = await client.requestCedia('cedia_get_auth_providers', {});
      return normalizeAuthProviders(result.data);
    } catch (error) {
      throw error instanceof ProviderAuthError ? error : new ProviderAuthError(describeAuthFailure(error), 503);
    } finally { await this.#release(client); }
  }

  #claim(): void {
    if (this.#closed) throw new ProviderAuthError('Provider settings are shutting down');
    if (this.#busy) throw new ProviderAuthError('Finish or cancel the current sign-in first');
    this.#busy = true;
  }

  async #mutate(command: 'cedia_set_api_key' | 'cedia_logout', payload: Record<string, unknown>): Promise<{ providers: ProviderAuthStatus[] }> {
    this.#claim();
    let client: AuthClient | undefined;
    try {
      client = await this.#start();
      // OMP re-runs provider discovery after the write, so this answer takes
      // longer than a metadata read and carries the refreshed rows with it.
      const result = await client.requestCedia(command, payload, { timeoutMs: 120_000 }).catch((error: unknown) => {
        throw error instanceof ProviderAuthError ? error : new ProviderAuthError(describeAuthFailure(error), 503);
      });
      this.#options.onChanged?.();
      return normalizeAuthProviders(result.data);
    } finally {
      if (client) await this.#release(client);
      this.#busy = false;
    }
  }

  saveApiKey(providerId: string, apiKey: string): Promise<{ providers: ProviderAuthStatus[] }> {
    return this.#mutate('cedia_set_api_key', { providerId, apiKey });
  }
  logout(providerId: string): Promise<{ providers: ProviderAuthStatus[] }> {
    return this.#mutate('cedia_logout', { providerId });
  }

  async login(providerId: string): Promise<ProviderLoginAttempt> {
    this.#claim();
    // Only a small in-memory history is retained, never auth codes or credentials.
    for (const [id, entry] of this.#logins) {
      if (this.#logins.size < 16) break;
      if (entry.state.status !== 'pending') this.#logins.delete(id);
    }
    const login: Login = { state: { id: randomUUID(), providerId, status: 'pending' } };
    this.#logins.set(login.state.id, login);
    try {
      login.client = await this.#start(frame => this.#receive(login, frame));
      if (login.state.status !== 'pending') { await this.#release(login.client); return this.getLogin(login.state.id); }
      login.completion = login.client.request('login', { providerId }, { timeoutMs: 600_000 })
        .then(() => {
          if (login.state.status !== 'pending') return;
          login.state = { id: login.state.id, providerId, status: 'succeeded' };
          this.#options.onChanged?.();
        }, () => {
          if (login.state.status !== 'pending') return;
          login.state = { id: login.state.id, providerId, status: 'failed', message: 'OMP could not complete sign-in. Retry, or use OMP in a terminal if this provider requires an interactive setup step.' };
        })
        .finally(async () => {
          if (login.client) await this.#release(login.client);
          this.#busy = false;
        });
      return this.getLogin(login.state.id);
    } catch {
      this.#busy = false;
      login.state = { id: login.state.id, providerId, status: 'failed', message: 'Could not start OMP sign-in. Check that the Cedia OMP runtime is installed.' };
      return this.getLogin(login.state.id);
    }
  }

  #receive(login: Login, frame: OmpFrame): void {
    if (login.state.status !== 'pending' || frame.type !== 'extension_ui_request') return;
    if (frame.method === 'open_url' && typeof frame.url === 'string') {
      try {
        const url = new URL(frame.url);
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return;
        login.state.url = url.href;
        if (typeof frame.instructions === 'string') login.state.instructions = frame.instructions;
      } catch { /* Invalid runtime URL is never forwarded to an external opener. */ }
    } else if (frame.method === 'input' && typeof frame.id === 'string') {
      login.state.prompt = {
        id: frame.id,
        message: typeof frame.title === 'string' ? frame.title : 'Paste the authorization code or callback URL',
        ...(typeof frame.placeholder === 'string' ? { placeholder: frame.placeholder } : {}),
      };
    } else if (frame.method === 'notify' && typeof frame.message === 'string') {
      login.state.message = frame.message.slice(0, 2_000);
    }
  }

  #find(id: string): Login {
    const login = this.#logins.get(id);
    if (!login) throw new ProviderAuthError('Sign-in attempt not found', 404);
    return login;
  }
  getLogin(id: string): ProviderLoginAttempt { return structuredClone(this.#find(id).state); }

  async respond(id: string, requestId: string, value: string): Promise<ProviderLoginAttempt> {
    const login = this.#find(id);
    if (login.state.status !== 'pending' || login.state.prompt?.id !== requestId || !login.client) {
      throw new ProviderAuthError('This sign-in prompt is no longer active');
    }
    // Consume before awaiting to reject a double submit. The answer is sent only to OMP.
    delete login.state.prompt;
    await login.client.send({ type: 'extension_ui_response', id: requestId, value });
    return this.getLogin(id);
  }

  async cancel(id: string): Promise<ProviderLoginAttempt> {
    const login = this.#find(id);
    if (login.state.status !== 'pending') return this.getLogin(id);
    login.state = { id, providerId: login.state.providerId, status: 'cancelled' };
    if (login.client) await this.#release(login.client);
    await login.completion;
    this.#busy = false;
    return this.getLogin(id);
  }

  async close(): Promise<void> {
    this.#closed = true;
    for (const login of this.#logins.values()) {
      if (login.state.status === 'pending') login.state = { id: login.state.id, providerId: login.state.providerId, status: 'cancelled' };
    }
    await Promise.allSettled([...this.#clients].map(client => this.#release(client)));
  }
}
