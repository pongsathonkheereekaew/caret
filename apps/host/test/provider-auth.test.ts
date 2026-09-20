import { describe, expect, it } from "bun:test";
import {
  describeAuthFailure,
  normalizeAuthProviders,
  ProviderAuthError,
} from "../src/provider-auth.ts";

/**
 * These rows cross a process boundary and then a network boundary, so the
 * projection is the place both the shape and the secrecy are decided. The
 * cases below are the ones a settings surface depends on: what a row may say,
 * and what a failure may reveal.
 */
describe("provider-auth rows from OMP", () => {
  it("keeps the fields a settings row needs and drops anything else", () => {
    const { providers } = normalizeAuthProviders({
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          methods: ["oauth", "api_key", "smtp"],
          available: true,
          authenticated: true,
          credentialKinds: ["oauth"],
          origin: "oauth",
          secret: "sk-do-not-forward",
        },
      ],
    });

    expect(providers).toHaveLength(1);
    const row = providers[0]!;
    expect(row.methods).toEqual(["oauth", "api_key"]);
    expect(row.credentialKinds).toEqual(["oauth"]);
    expect(row.origin).toBe("oauth");
    // An unrecognized field is not forwarded to a remote client.
    expect(Object.keys(row)).not.toContain("secret");
    expect(JSON.stringify(providers)).not.toContain("sk-do-not-forward");
  });

  it("drops rows that are not actionable or not recognizable", () => {
    const { providers } = normalizeAuthProviders({
      providers: [
        { id: "no-methods", name: "No methods", methods: [] },
        { id: "", name: "No id", methods: ["oauth"] },
        { id: "no-name", methods: ["oauth"] },
        "not an object",
        { id: "usable", name: "Usable", methods: ["api_key"], authenticated: true },
      ],
    });

    expect(providers.map((row) => row.id)).toEqual(["usable"]);
    // An unknown origin is left off rather than forwarded as a guess.
    expect(providers[0]!.origin).toBeUndefined();
  });

  it("refuses a payload that is not a provider list", () => {
    expect(() => normalizeAuthProviders({})).toThrow(ProviderAuthError);
    expect(() => normalizeAuthProviders(null)).toThrow(ProviderAuthError);
  });
});

describe("provider-auth failures", () => {
  it("passes through the two failures a user can act on", () => {
    expect(describeAuthFailure(new Error("This OMP runtime does not advertise the Cedia provider-auth bridge"))).toBe(
      "This OMP runtime does not advertise the Cedia provider-auth bridge",
    );
    expect(describeAuthFailure(new Error("Unknown OAuth provider: nope"))).toBe("Unknown OAuth provider: nope");
  });

  it("replaces anything else, because it may carry a path or a credential", () => {
    const described = describeAuthFailure(new Error("spawn /Users/someone/.omp/bin/omp failed: sk-live-123"));
    expect(described).not.toContain("/Users/someone");
    expect(described).not.toContain("sk-live-123");
    expect(described).toContain("OMP could not complete the provider-auth request");
  });
});
