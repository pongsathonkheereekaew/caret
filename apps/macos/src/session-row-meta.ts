/** D04 / D18: sidebar row environment / source / PR. This Mac is the only compute destination. OMP is the only session owner. */

export const SESSION_ENV_THIS_MAC = "This Mac";
export const SESSION_SOURCE_OMP = "omp";
export const SESSION_PR_UNKNOWN = "Unknown";

const SOURCE_LINE_OMP = "OMP";

export interface SessionRowMeta {
	readonly environment: string;
	readonly source: string;
	readonly pr: string;
	readonly lines: readonly string[];
}

export function sessionRowMeta(session: {
	readonly environment?: string;
	readonly source?: string;
	readonly pr?: string | null;
	readonly cwd?: string;
}): SessionRowMeta {
	const environment = environmentOf(session);
	const source = sourceOf(session);
	const pr = prDisplayOf(session);
	const cwd = clean(session.cwd);
	const lines = [environment, sourceLine(source), `PR ${pr}`, ...(cwd ? [cwd] : [])];
	return { environment, source, pr, lines };
}

export function projectSessionFilterFields<T extends object>(session: T): T & { environment: string; source: string; pr: string | null } {
	const fields = session as T & { readonly environment?: string; readonly source?: string; readonly pr?: string | null };
	return {
		...session,
		environment: environmentOf(fields),
		source: sourceOf(fields),
		pr: advertisedPr(fields.pr),
	};
}

function environmentOf(session: { readonly environment?: string }): string {
	return clean(session.environment) || SESSION_ENV_THIS_MAC;
}

function sourceOf(session: { readonly source?: string }): string {
	return clean(session.source) || SESSION_SOURCE_OMP;
}

function prDisplayOf(session: { readonly pr?: string | null }): string {
	return advertisedPr(session.pr) ?? SESSION_PR_UNKNOWN;
}

function advertisedPr(value: string | null | undefined): string | null {
	const trimmed = clean(value);
	if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
	return trimmed;
}

function sourceLine(source: string): string {
	return source === SESSION_SOURCE_OMP ? SOURCE_LINE_OMP : source;
}

function clean(value: string | null | undefined): string {
	return value?.trim() ?? "";
}
