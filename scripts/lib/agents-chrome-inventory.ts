/** Caret <-> Cursor chrome inventory, for the acceptance check the plan calls
 * "AX/DOM comparison" (section 10 item 16, the decider for section 11 gate 2).
 *
 * The reference side is a captured accessibility tree (Computer Use, Cursor
 * 3.20.17 - docs/maintenance/evidence/cursor-agents-ax-2026-09-14/) and the
 * Caret side is a dump of the running window, either the same kind of tree or
 * the workbench DOM over CDP. Both sides are reduced to one control inventory -
 * the chrome controls a user can see and press - and compared. The direction
 * that decides parity is the reference's: a label the reference has and Caret
 * does not is a missing control; a Caret-only label is reported but does not
 * fail, because Caret may legitimately offer more (its own surfaces, section 4).
 *
 * Pure functions only; the CLI and the CDP capture live in
 * scripts/agents-chrome-inventory.ts so this half is testable without a window.
 */

export interface ChromeControl {
	/** `button`, `pop up button`, `text entry area`, `splitter`, `container`, ... */
	readonly role: string;
	/** The label as captured, shortcut and value attributes trimmed. */
	readonly label: string;
}

/** Roles that are a control a user can see and press, rather than content. */
const CHROME_ROLES = [
	"button",
	"pop up button",
	"toggle button",
	"text entry area",
	"combo box",
	"splitter",
	"toolbar",
	"tab group",
	"sortable",
] as const;

/** Attribute tails the capture formats append: shortcuts, values, descriptions. */
const ATTRIBUTE_TAIL = /(?:\s(?:⇧|⌘|⌥|⌃|⇪)[A-Za-z0-9+]+|\sDescription:.*|\sValue:.*|\s\(settable\)|\s\(disabled\))+$/;

/** State markers a capture puts before the label: `button (disabled) Go Back`. */
const ATTRIBUTE_HEAD = /^\((?:disabled|settable|selected|focused)\)\s+/;

/**
 * A node whose capture carries only attributes, no label: `splitter
 * Description: Resize panel, Value: 100` and `toggle button Description:
 * Settings, Value: 0`. The description is the readable name a user sees, so it
 * becomes the label instead of the raw attribute text.
 */
const DESCRIPTION_ONLY = /^Description:\s*([^,]+)(?:,\s*Value:.*)?$/;

/**
 * Reduce a captured accessibility tree to its control inventory.
 *
 * Accepts the indented text format the reference capture uses - `\t\t6 button
 * Hide Sidebar`, `pop up button caret`, `combo box (settable) main` - so one
 * parser serves both sides.
 */
export function chromeControlsFromTree(text: string): readonly ChromeControl[] {
	const controls: ChromeControl[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.replace(/\t/g, " ").trim();
		if (!line) continue;
		// The reference capture prefixes each node with its index.
		const withoutIndex = line.replace(/^\d+\s+/, "");
		for (const role of CHROME_ROLES) {
			const lower = withoutIndex.toLowerCase();
			if (!lower.startsWith(`${role} `)) continue;
			const label = cleanLabel(withoutIndex.slice(role.length));
			if (label) controls.push({ role, label });
			break;
		}
	}
	return dedupe(controls);
}

/** Trim the trailing shortcut/value attributes a capture appends to a label. */
export function cleanLabel(raw: string): string {
	const flattened = raw.replace(/\t/g, " ").trim();
	const withoutHead = flattened.replace(ATTRIBUTE_HEAD, "").trim();
	const descriptionOnly = withoutHead.match(DESCRIPTION_ONLY);
	if (descriptionOnly) return descriptionOnly[1]!.trim();
	return withoutHead.replace(ATTRIBUTE_TAIL, "").trim();
}

function dedupe(controls: readonly ChromeControl[]): readonly ChromeControl[] {
	const seen = new Set<string>();
	const out: ChromeControl[] = [];
	for (const control of controls) {
		const key = `${control.role}|${control.label}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(control);
	}
	return out;
}

export interface ChromeDiff {
	/** In the reference, absent from Caret - the parity failures. */
	readonly missing: readonly ChromeControl[];
	/** In Caret, absent from the reference - informational (section 4), not failures. */
	readonly extra: readonly ChromeControl[];
	readonly shared: readonly ChromeControl[];
}

/**
 * Compare a Caret inventory against the reference's.
 *
 * Matching is on the label, with the role as a second pass: a label can move
 * between control kinds between Code-OSS builds (`button` vs `pop up button`)
 * without the user seeing a difference, so a comparison that failed on the role
 * would report noise instead of parity. A label that appears more than once on
 * either side is consumed one for one.
 */
export function diffChrome(reference: readonly ChromeControl[], caret: readonly ChromeControl[]): ChromeDiff {
	const remaining = new Map<string, ChromeControl[]>();
	for (const control of caret) {
		const list = remaining.get(control.label);
		if (list) list.push(control);
		else remaining.set(control.label, [control]);
	}
	const missing: ChromeControl[] = [];
	const shared: ChromeControl[] = [];
	for (const control of reference) {
		const match = remaining.get(control.label);
		if (match && match.length > 0) {
			match.shift();
			shared.push(control);
			continue;
		}
		missing.push(control);
	}
	const referenceLabels = new Set(reference.map(control => control.label));
	const extra = caret.filter(control => !referenceLabels.has(control.label));
	return { missing, extra, shared };
}

/** One line per control, stable order, for a receipt or a diff. */
export function formatInventory(controls: readonly ChromeControl[]): string {
	return [...controls]
		.sort((a, b) => `${a.role}|${a.label}`.localeCompare(`${b.role}|${b.label}`))
		.map(control => `${control.role}\t${control.label}`)
		.join("\n");
}
