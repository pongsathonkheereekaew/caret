import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../App.tsx"), "utf8");

describe("D02 Dynamic Type projection", () => {
  test("scales reading surfaces from D02 roles without inventing Cloud", () => {
    expect(appSource).toContain("dynamicTypeRoles");
    expect(appSource).toContain("scaledSize");
    expect(appSource).toContain("liveFontScale");
    expect(appSource).toContain("PixelRatio.getFontScale()");
    expect(appSource).not.toContain("Cloud Agent");
  });
});

describe("D14 inbox navigation", () => {
  test("keeps Tasks / Activity / Settings and folds Projects into Tasks", () => {
    expect(appSource).toContain('type MobileInboxView = "tasks" | "activity" | "settings"');
    expect(appSource).toContain('setSelectedView("tasks")');
    expect(appSource).toContain('setSelectedView("activity")');
    expect(appSource).toContain('setSelectedView("settings")');
    expect(appSource).not.toContain('setSelectedView("projects")');
    expect(appSource).not.toMatch(/selectedView === "projects"/);
    expect(appSource).toContain("bottomNav");
    expect(appSource).not.toContain("compact />");
  });

  test("Activity inbox is cross-session and pairing revoke stays local", () => {
    expect(appSource).toContain("activityInbox");
    expect(appSource).toContain("mergeActivityInbox");
    expect(appSource).toContain("getPendingUi");
    expect(appSource).toContain("getCommands");
    expect(appSource).toContain("activityInboxItemFromHostCommand");
    expect(appSource).toContain("activityInboxForSession");
    expect(appSource).toContain("activityInboxFilterChips");
    expect(appSource).toContain("activityInboxTapAnswersRequest");
    expect(appSource).toContain("activityInboxTapAction");
    expect(appSource).toContain("revokePairing");
    expect(appSource).toContain('accessibilityLabel="Revoke pairing"');
    expect(appSource).toContain("there is no host revoke receipt");
    expect(appSource).toContain('accessibilityLabel="Pair again"');
    expect(appSource).toContain('accessibilityLabel="Connect your Mac"');
    expect(appSource).toContain("onOpenPairing={() => setShowPairing(true)}");
    expect(appSource).toContain("<PairingSheet visible={showPairing}");
    expect(appSource).not.toContain("host revoke receipt received");
  });
});

describe("D14 continuity and pairing verify", () => {
  test("stops catch-up polling off-screen and shows Updating without a new connection enum", () => {
    expect(appSource).toContain("const [appState, setAppState]");
    expect(appSource).toContain('appState !== "active"');
    expect(appSource).toContain("setSyncing(true)");
    expect(appSource).toContain("shouldFetchNextHostEventPage");
    expect(appSource).toContain("page.hasMore");
    expect(appSource).not.toContain("while (stateRef.current.hasMoreEvents");
    expect(appSource).toContain("foreground: true");
    expect(appSource).toContain("connectionBadgeLabel(state.connection, { syncing, lastKnownAt: state.cacheSavedAt })");
    expect(appSource).toContain("iosComposerHonesty");
    expect(appSource).toContain("iosComposerAllowsCommand");
    expect(appSource).toContain("disabled={!composer.primaryEnabled || props.busy || props.syncing}");
    expect(appSource).toContain("disabled={!composer.stopEnabled || props.busy || props.syncing}");
    expect(appSource).toContain("disabled={!composer.steerEnabled || props.busy || props.syncing}");
    expect(appSource).toContain("disabled={!composer.queueEnabled || props.busy || props.syncing}");
    expect(appSource).toContain("accessibilityHint={composer.primaryReason}");
    expect(appSource).toContain("accessibilityHint={composer.stopReason}");
    expect(appSource).toContain("accessibilityHint={composer.steerReason}");
    expect(appSource).toContain("accessibilityHint={composer.queueReason}");
    expect(appSource).toContain("modelOptionSelectable");
    expect(appSource).toContain("disabled={state.connection === \"offline\" || props.busy || props.syncing}");
    expect(appSource).toContain("props.busy || props.syncing || state.connection === \"offline\"");
    expect(appSource).toContain("const sendPrompt = useCallback(() => {\n    if (syncing) return;");
    expect(appSource).toContain("const sendTerminalInput = useCallback((identity: VirtualTerminalIdentity, data: string) => {\n    if (syncing) return;");
    expect(appSource).toContain("const sendUiResponse = useCallback(async (request: PendingUiRequest, answer: UiResponseRequest[\"answer\"]) => {\n    if (syncing) return;");
    expect(appSource).toContain("syncing={syncing}");
    expect(appSource).toContain("disabled={props.syncing}");
    expect(appSource).toContain("allowAnswer === undefined || props.syncing");
    expect(appSource).not.toContain('status: "syncing"');
    expect(appSource).not.toMatch(/connection:\s*"syncing"/);
  });

  test("persists drafts, last-sync, and landscape composer without inventing backends", () => {
    expect(appSource).toContain("readStoredDraft");
    expect(appSource).toContain("writeStoredDraft");
    expect(appSource).toContain("clearStoredDraft");
    expect(appSource).toContain("clearSnapshotCache");
    expect(appSource).toContain("lastSyncLabel");
    expect(appSource).toContain('accessibilityLabel="Clear cache"');
    expect(appSource).toContain("useWindowDimensions");
    expect(appSource).toContain("windowHeight * 0.4");
    expect(appSource).toContain("windowHeight < 500");
    expect(appSource).toContain('accessibilityLabel="Expand input"');
    expect(appSource).toContain("next !== \"active\"");
    expect(appSource).not.toContain("void sendPrompt()");
  });

  test("pairing parse reviews the Mac before import and splits relay vs Mac copy", () => {
    expect(appSource).toContain("reviewOffer");
    expect(appSource).toContain("pairingPublicKeyFingerprint");
    expect(appSource).toContain('accessibilityLabel="Import this Mac"');
    expect(appSource).toContain("Import this Mac");
    expect(appSource).toContain("setReviewOffer(offer)");
    expect(appSource).not.toContain("props.onImport(offer); setText(\"\"); setScan(false)");
    expect(appSource).toContain("relayState");
    expect(appSource).toContain("hostReachabilityCopy");
  });
});

describe("UiSheet presentation", () => {
  test("sticky Allow/Deny are distinct from swipe/back/close", () => {
    expect(appSource).toContain('if (ui.method === "confirm") return true;');
    expect(appSource).toContain('return ui.method === "confirm" ? false : { cancelled: true };');
    expect(appSource).toContain("onRequestClose={closePresentation}");
    expect(appSource).toContain('accessibilityLabel="Allow"');
    expect(appSource).toContain('accessibilityLabel="Deny"');
    expect(appSource).toContain("uiSheetFooter");
    expect(appSource).not.toContain("Cancel interaction");
    expect(appSource).not.toContain("readonly ? props.onClose() : submit({ cancelled: true })");
    expect(appSource).toContain("IOS_HOST_UPLOAD_COPY");
    expect(appSource).toContain('label: "Automations"');
    expect(appSource).toContain('label: "Voice"');
    expect(appSource).toContain('label: "Cloud"');
    expect(appSource).toContain("System notifications stay off until a Caret notification contract exists");
  });

  test("unknown outcomes inspect on Mac instead of Retry-on-unknown", () => {
    expect(appSource).toContain("Inspect {command.command}");
    expect(appSource).not.toContain("Retry {command.command}");
    expect(appSource).not.toContain('onRetry={commandId => void dispatchCommand({ command: "prompt", commandId, retryUnknown: true })}');
    expect(appSource).toContain("iosApprovalStatusCopy");
  });
});

describe("D14 review surface", () => {
  test("task detail Review is a read-only Mac-owned Git sheet", () => {
    expect(appSource).toContain('accessibilityLabel="Open review"');
    expect(appSource).toContain("iosReviewSheetFromHost");
    expect(appSource).toContain("getReview");
    expect(appSource).toContain("model.emptyTitle");
    expect(appSource).toContain("model.emptyBody");
    expect(appSource).toContain("model.ownership");
    expect(appSource).toContain("iosReviewSheetModel");
    expect(appSource).toContain("reviewActionButton");
    expect(appSource).toContain("minHeight: 44");
    expect(appSource).toContain("model.hunks.map");
    expect(appSource).toContain("model.diffNote");
    expect(appSource).toContain("hunk.path");
    expect(appSource).toContain("hunk.header");
    expect(appSource).not.toContain("git init");
    expect(appSource).not.toContain("Initialize Repository");
    expect(appSource).not.toContain("expo-clipboard");
  });
});

describe("D14 orientation", () => {
  test("unlocks iPhone orientation instead of locking portrait", () => {
    const appJson = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../app.json"), "utf8");
    expect(appJson).toContain('"orientation": "default"');
    expect(appJson).not.toContain('"orientation": "portrait"');
  });
});

describe("D18 thinking projection", () => {
  test("lists advertised thinking levels only and does not invent Fast or High", () => {
    expect(appSource).toContain("thinkingFromOmpState");
    expect(appSource).toContain("set_thinking_level");
    expect(appSource).toContain("THINKING_NOT_ADVERTISED");
    expect(appSource).toContain("does not invent Fast or High");
    expect(appSource).toContain('accessibilityLabel="Thinking level"');
    expect(appSource).toContain("parent ${props.parentSession}");
  });
});

