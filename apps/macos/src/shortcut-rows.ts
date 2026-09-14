/** S16 / D13 shortcut rows from package contributes. Presentation only — no invented chords. */

export interface ShortcutRow {
	readonly id: string;
	readonly command: string;
	readonly title: string;
	readonly keybinding: string;
}

export function shortcutRowsFromContributes(contributes: unknown): readonly ShortcutRow[] {
	if (!contributes || typeof contributes !== "object" || Array.isArray(contributes)) return [];
	const record = contributes as Record<string, unknown>;
	const titles = commandTitles(record.commands);
	const rows: ShortcutRow[] = [];
	const seen = new Set<string>();
	if (!Array.isArray(record.keybindings)) return [];
	for (const item of record.keybindings) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const binding = item as Record<string, unknown>;
		if (typeof binding.command !== "string" || !binding.command.startsWith("caret.")) continue;
		if (seen.has(binding.command)) continue;
		const keybinding = pickKeybinding(binding);
		if (!keybinding) continue;
		seen.add(binding.command);
		rows.push({
			id: binding.command,
			command: binding.command,
			title: titles.get(binding.command) ?? binding.command,
			keybinding,
		});
	}
	return rows;
}

function commandTitles(value: unknown): Map<string, string> {
	const titles = new Map<string, string>();
	if (!Array.isArray(value)) return titles;
	for (const item of value) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const command = item as Record<string, unknown>;
		if (typeof command.command !== "string" || !command.command.startsWith("caret.")) continue;
		if (titles.has(command.command)) continue;
		titles.set(command.command, typeof command.title === "string" && command.title ? command.title : command.command);
	}
	return titles;
}

function pickKeybinding(binding: Record<string, unknown>): string | undefined {
	if (typeof binding.mac === "string" && binding.mac.trim()) return binding.mac;
	if (typeof binding.key === "string" && binding.key.trim()) return binding.key;
	return undefined;
}
