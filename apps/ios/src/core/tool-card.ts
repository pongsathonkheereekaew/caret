export const TOOL_CARD_BODY_CAP_PX = 240;

const COLLAPSED_LINES_COMFORTABLE = 4;
const COLLAPSED_LINES_DETAILED = 16;

export function toolCardDefaultExpanded(status: string | undefined): boolean {
  return status !== "completed" && status !== "success";
}

export function toolCardBody(input: {
  text: string;
  expanded: boolean;
  density: "comfortable" | "detailed" | string;
}): { visible: string; truncated: boolean; numberOfLines?: number } {
  if (input.expanded) return { visible: input.text, truncated: false };
  const numberOfLines = input.density === "detailed" ? COLLAPSED_LINES_DETAILED : COLLAPSED_LINES_COMFORTABLE;
  const lines = input.text.split(/\r?\n/);
  if (lines.length <= numberOfLines) return { visible: input.text, truncated: false, numberOfLines };
  return { visible: lines.slice(0, numberOfLines).join("\n"), truncated: true, numberOfLines };
}

export function toolCardCopyText(entry: {
  toolName?: string;
  args?: unknown;
  output?: string;
  text?: string;
}): string {
  const parts: string[] = [];
  if (entry.toolName) parts.push(entry.toolName);
  if (entry.args !== undefined) {
    parts.push(typeof entry.args === "object" && entry.args !== null ? JSON.stringify(entry.args) : String(entry.args));
  }
  if (typeof entry.output === "string" && entry.output) parts.push(entry.output);
  if (typeof entry.text === "string" && entry.text) parts.push(entry.text);
  return parts.join("\n");
}
