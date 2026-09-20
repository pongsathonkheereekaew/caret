/** Cedia <-> Cursor chrome inventory, for the acceptance check the plan calls
 * "AX/DOM comparison" (section 10 item 16, the decider for section 11 gate 2).
 *
 * The reference side is a captured accessibility tree (Computer Use, Cursor
 * 3.20.17 - docs/maintenance/evidence/cursor-agents-ax-2026-09-14/) and the
 * Cedia side is a dump of the running window, either the same kind of tree or
 * the workbench DOM over CDP. Both sides are reduced to one control inventory -
 * the chrome controls a user can see and press - and compared. The direction
 * that decides parity is the reference's: a label the reference has and Cedia
 * does not is a missing control; a Cedia-only label is reported but does not
 * fail, because Cedia may legitimately offer more (its own surfaces, section 4).
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
 * A DOM aria-label carries its shortcut, an AX node carries it as a separate
 * node: `Toggle Side Bar (⌘B)` is the reference's `button Toggle Side Bar` plus
 * `text ⌘B`. Strip it so the two vocabularies match.
 *
 * Only modifiers and key names count: `Models, DeepSeek V4.1 Flash (Command
 * Code)` keeps its parentheses, because a product name is a label, not a key.
 */
const SHORTCUT_TAIL = /(?:\s\((?:[⌘⌥⌃⇧⇪][^)\s]*|Enter|Escape|Backspace|Delete|Tab|Space)\))+$/;

/** A session row's captured state, which the reference writes as node text. */
const ROW_STATE_TAIL = /,\s*State:.*$/;

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
 * Hide Sidebar`, `pop up button cedia`, `combo box (settable) main` - so one
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
	return withoutHead
		.replace(ATTRIBUTE_TAIL, "")
		.replace(SHORTCUT_TAIL, "")
		.replace(ROW_STATE_TAIL, "")
		.trim();
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
	/** Nothing in Cedia resembles it - the parity failures. */
	readonly missing: readonly ChromeControl[];
	/** The control exists under different words, with the pair that matched. */
	readonly renamed: readonly { readonly reference: ChromeControl; readonly cedia: ChromeControl }[];
	/** Absent by a recorded decision (section 5 / a named patch), not a failure. */
	readonly deviations: readonly ChromeControl[];
	/** In Cedia, absent from the reference - informational (section 4), not failures. */
	readonly extra: readonly ChromeControl[];
	readonly shared: readonly ChromeControl[];
}

/**
 * Controls the reference has and this build deliberately does not. Each one is
 * recorded in the plan or in a named patch, so the comparison can tell a
 * decision apart from a miss; a label here without a reason would be an excuse,
 * which is why the reason travels with it.
 */
export const RECORDED_DEVIATIONS: readonly { readonly label: string; readonly reason: string }[] = [
	{ label: "Enter Full Screen", reason: "section 5: the Agents window keeps its current panel controls" },
	{ label: "Hide Apps", reason: "section 5: the Agents window keeps its current panel controls" },
	{ label: "Account menu", reason: "patch 0029 removes the account widget on purpose" },
	{ label: "Tabs", reason: "patch 0017 draws the panel's own launcher strip and hides the native tab group, which is the reference's named Tabs group" },
];

const deviationFor = (label: string): boolean => RECORDED_DEVIATIONS.some(entry => entry.label === label);

/**
 * A captured accessibility tree merges a row's text children into its parent
 * button (`Projects New Project`), while the DOM exposes them as separate
 * controls (`New Project`); the same merge makes a Cedia label longer than the
 * reference's when the reference leaves context to the window (`Go Back` is
 * `Go Back One Session` in Cedia). Both shapes are edge matches: one label is a
 * whole-word prefix or suffix of the other, with at most two words of slack.
 *
 * Deliberately not a substring test. `Debug an issue Find root causes and fix
 * tricky bugs` contains `Find`, and that pair is two different controls (a
 * starter card and the transcript's find box); matching them would hide a real
 * difference behind a capture artefact.
 */
function edgeMatch(a: string, b: string): boolean {
	if (a === b) return true;
	const [long, short] = a.length >= b.length ? [a, b] : [b, a];
	const longWords = long.split(" ");
	const shortWords = short.split(" ");
	const slack = 2;
	if (shortWords.length >= longWords.length) return false;
	const suffix = longWords.slice(-shortWords.length).join(" ");
	if (suffix === short && longWords.length - shortWords.length <= slack) return true;
	const prefix = longWords.slice(0, shortWords.length).join(" ");
	if (prefix === short && longWords.length - shortWords.length <= slack + 1) return true;
	return false;
}

/**
 * Compare a Cedia inventory against the reference's.
 *
 * Matching is on the label, with the role left out: a label can move between
 * control kinds between Code-OSS builds (`button` vs `pop up button`) without
 * the user seeing a difference, so a comparison that failed on the role would
 * report noise instead of parity. A label that appears more than once on either
 * side is consumed one for one.
 */
export function diffChrome(reference: readonly ChromeControl[], cedia: readonly ChromeControl[]): ChromeDiff {
	const remaining = [...cedia];
	const take = (predicate: (control: ChromeControl) => boolean): ChromeControl | undefined => {
		const index = remaining.findIndex(predicate);
		return index === -1 ? undefined : remaining.splice(index, 1)[0]!;
	};
	const missing: ChromeControl[] = [];
	const renamed: { reference: ChromeControl; cedia: ChromeControl }[] = [];
	const deviations: ChromeControl[] = [];
	const shared: ChromeControl[] = [];
	for (const control of reference) {
		const exact = take(candidate => candidate.label === control.label);
		if (exact) {
			shared.push(control);
			continue;
		}
		const similar = take(candidate => edgeMatch(candidate.label, control.label));
		if (similar) {
			renamed.push({ reference: control, cedia: similar });
			continue;
		}
		if (deviationFor(control.label)) {
			deviations.push(control);
			continue;
		}
		missing.push(control);
	}
	const referenceLabels = new Set(reference.map(control => control.label));
	const extra = remaining.filter(control => !referenceLabels.has(control.label));
	return { missing, renamed, deviations, extra, shared };
}

/** The recorded decisions a diff hit, with their reasons, for the report. */
export function deviationReasons(controls: readonly ChromeControl[]): readonly string[] {
	return controls.map(control => `${control.label} - ${RECORDED_DEVIATIONS.find(entry => entry.label === control.label)?.reason ?? "unrecorded"}`);
}

/** One line per control, stable order, for a receipt or a diff. */
export function formatInventory(controls: readonly ChromeControl[]): string {
	return [...controls]
		.sort((a, b) => `${a.role}|${a.label}`.localeCompare(`${b.role}|${b.label}`))
		.map(control => `${control.role}\t${control.label}`)
		.join("\n");
}
