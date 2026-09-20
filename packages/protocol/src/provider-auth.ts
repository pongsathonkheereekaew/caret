/** Public authentication state. Credentials never appear in these responses. */
export interface ProviderAuthStatus {
  id: string;
  name: string;
  methods: ('oauth' | 'api_key')[];
  /** False when OMP's own registry marks this provider's login unusable here. */
  available: boolean;
  authenticated: boolean;
  /** Kinds of credential OMP has stored. Never the credential itself. */
  credentialKinds: ('oauth' | 'api_key')[];
  /** Which source is resolving right now, when one is. */
  origin?: 'runtime' | 'config' | 'oauth' | 'api_key' | 'env' | 'fallback';
  /** Env var backing an `env` origin. */
  envVar?: string;
  /** Provider id an OAuth login stores under, when it differs from `id`. */
  storeCredentialsAs?: string;
}

export interface ProviderLoginAttempt {
  id: string;
  providerId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  url?: string;
  instructions?: string;
  message?: string;
  prompt?: { id: string; message: string; placeholder?: string };
}

export interface CediaProviderAuthApi {
  list(): Promise<{ providers: ProviderAuthStatus[] }>;
  saveApiKey(providerId: string, apiKey: string): Promise<{ providers: ProviderAuthStatus[] }>;
  logout(providerId: string): Promise<{ providers: ProviderAuthStatus[] }>;
  login(providerId: string): Promise<ProviderLoginAttempt>;
  getLogin(id: string): Promise<ProviderLoginAttempt>;
  respond(id: string, requestId: string, value: string): Promise<ProviderLoginAttempt>;
  cancel(id: string): Promise<ProviderLoginAttempt>;
}
