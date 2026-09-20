export function isParserQuery(
  kind: "csi" | "osc" | "dcs",
  paramsOrData?: unknown,
  prefix?: string,
  final?: string,
): boolean;
export function isSyntheticTerminalReply(data: string): boolean;
export function takeTerminalParserQueries(data: string, carry?: string): { text: string; carry: string };
export function stripTerminalParserQueries(data: string, carry?: string): string;
