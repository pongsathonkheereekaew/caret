import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import WebView from "react-native-webview";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Command, Json, Project, Session, UiResponseRequest } from "../../packages/protocol/src/index.ts";
import {
  CaretApi,
  CommandLedger,
  createCachedSnapshot,
  isSafeExternalUrl,
  loginProvidersFromCommand,
  createCommandId,
  createInitialMobileState,
  isCacheFresh,
  parsePairingOffer,
  readCachedSnapshot,
  readStoredPairingOffer,
  reduceMobileState,
  restoreCachedSnapshot,
  savePairingSecrets,
  createMobileRelayTransport,
  type ClientTransport,
  type MobileTaskState,
  type PairingOffer,
  type PairingSecretStore,
  type PendingUiRequest,
  type SnapshotCache,
  type TranscriptEntry,
  type LoginProviderOption,
  type ModelOption,
  type UiPresentation,
  type VirtualTerminalIdentity,
  artifactDataUri,
  artifactDisplaySize,
  artifactKind,
  decodeUtf8,
  downloadArtifact,
  readArtifactBytes,
  type ArtifactKind,
  type ArtifactReceipt,
} from "./src/core/index.ts";
import { terminalInputCommand, terminalNegotiateCommand, terminalResizeCommand } from "./src/core/virtual-terminal.ts";
import { VirtualTerminalPanel } from "./src/components/VirtualTerminal.tsx";
import { taskSnapshotCache } from "./src/storage/cache.ts";
import { securePairingStore } from "./src/storage/secure.ts";

export interface CaretMobileAppProps {
  /** Inject the host/relay implementation. An absent transport is rendered as unavailable. */
  readonly transport?: ClientTransport;
  readonly secretStore?: PairingSecretStore;
  readonly cache?: SnapshotCache;
}

interface Palette {
  readonly bg: string;
  readonly surface: string;
  readonly elevated: string;
  readonly border: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly white: string;
}

const LIGHT: Palette = {
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  elevated: "#F0F2F7",
  border: "#E3E6EE",
  text: "#172033",
  muted: "#687187",
  accent: "#6D5CF6",
  accentSoft: "#EEECFF",
  success: "#2A9D72",
  warning: "#C78127",
  danger: "#C95061",
  white: "#FFFFFF",
};

const DARK: Palette = {
  bg: "#10131B",
  surface: "#181D28",
  elevated: "#222938",
  border: "#30384A",
  text: "#F4F6FB",
  muted: "#A3ACC0",
  accent: "#9A8CFF",
  accentSoft: "#2B2752",
  success: "#60D3A5",
  warning: "#E7B36D",
  danger: "#F17C89",
  white: "#FFFFFF",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonRecord(value: unknown): Record<string, Json> {
  return isRecord(value) ? value as Record<string, Json> : {};
}

function frameType(frame: Record<string, unknown>): string {
  const value = frame.type ?? frame.kind ?? frame.event;
  return typeof value === "string" ? value : "event";
}

function commandData(command: Command): unknown {
  if (isRecord(command.result)) return command.result.data ?? command.result;
  if (isRecord(command.ack)) return command.ack.data ?? command.ack;
  return command.result ?? command.ack;
}

function modelOptions(command: Command): ModelOption[] {
  const data = commandData(command);
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.models) ? data.models : [];
  return list.flatMap((value): ModelOption[] => {
    if (typeof value === "string" && value.trim()) return [{ id: value, label: value }];
    if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) return [];
    return [{ id: value.id, label: typeof value.label === "string" ? value.label : value.id, ...(typeof value.provider === "string" ? { provider: value.provider } : {}), ...(typeof value.available === "boolean" ? { available: value.available } : {}), ...(typeof value.reason === "string" ? { reason: value.reason } : {}) }];
  });
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function statusColor(status: MobileTaskState["connection"], palette: Palette): string {
  if (status === "connected" || status === "running") return palette.success;
  if (status === "connecting" || status === "reconnecting") return palette.warning;
  return palette.muted;
}

function sanitizeText(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

function artifactKindLabel(kind: ArtifactKind): string {
  if (kind === "text") return "Text";
  if (kind === "image") return "Image";
  if (kind === "audio") return "Audio";
  if (kind === "video") return "Video";
  return "File";
}

function artifactMediaDocument(uri: string, kind: "audio" | "video", title: string): string {
  // The artifact is always a data URI in the media attribute. JavaScript is
  // disabled on the native WebView and no artifact HTML is ever interpolated
  // into this document, so an HTML artifact cannot execute as a preview.
  const tag = kind === "audio" ? "audio" : "video";
  const controls = kind === "audio" ? "controls" : "controls playsinline preload=metadata";
  const safeTitle = title.replace(/[&<>\"']/g, "_");
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html,body{margin:0;background:#10131b;color:#f4f6fb;display:grid;place-items:center;min-height:100%;font-family:-apple-system,sans-serif}audio,video{max-width:100%;width:100%}</style><${tag} ${controls} src="${uri}"></${tag}>`;
}

export default function App(props: CaretMobileAppProps = {}) {
  return (
    <SafeAreaProvider>
      <CaretRoot {...props} />
    </SafeAreaProvider>
  );
}

function CaretRoot({ transport, secretStore = securePairingStore, cache = taskSnapshotCache }: CaretMobileAppProps) {
  const colorScheme = useColorScheme();
  const palette = colorScheme === "dark" ? DARK : LIGHT;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [state, dispatch] = useReducer(reduceMobileState, undefined, () => createInitialMobileState());
  const stateRef = useRef(state);
  const ledgerRef = useRef(new CommandLedger());
  const [showPairing, setShowPairing] = useState(!transport);
  const [pairedOffer, setPairedOffer] = useState<PairingOffer | null>(null);
  const [pairedTransport, setPairedTransport] = useState<ClientTransport | undefined>();
  const relayClientRef = useRef<ReturnType<typeof createMobileRelayTransport>["client"] | null>(null);
  const [selectedView, setSelectedView] = useState<"tasks" | "projects">("tasks");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showLoginPicker, setShowLoginPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [artifactSession, setArtifactSession] = useState<{ readonly id: string; readonly incarnation: string } | null>(null);
  const [artifacts, setArtifacts] = useState<readonly ArtifactReceipt[]>([]);
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [artifactViewer, setArtifactViewer] = useState<ArtifactReceipt | null>(null);
  const [showArtifactCapture, setShowArtifactCapture] = useState(false);
  const activeTransport = transport ?? pairedTransport;
  const api = useMemo(() => activeTransport ? new CaretApi({ transport: activeTransport }) : null, [activeTransport]);
  const insets = useSafeAreaInsets();

  useEffect(() => { stateRef.current = state; }, [state]);

  // Artifact sheets are task-scoped. Switching tasks or incarnations closes
  // every preview so a delayed relay response cannot render under a new task.
  useEffect(() => {
    if (!artifactSession) return;
    const current = state.session;
    if (current?.id === artifactSession.id && current.incarnation === artifactSession.incarnation) return;
    setShowArtifacts(false);
    setShowArtifactCapture(false);
    setArtifactViewer(null);
  }, [artifactSession, state.session?.id, state.session?.incarnation]);

  useEffect(() => {
    if (transport || pairedOffer) return;
    let cancelled = false;
    void readStoredPairingOffer(secretStore).then(offer => {
      if (cancelled || !offer) return;
      setPairedOffer(offer);
      setShowPairing(false);
    });
    return () => { cancelled = true; };
  }, [pairedOffer, secretStore, transport]);

  const setConnection = useCallback((status: MobileTaskState["connection"], error?: string) => {
    dispatch({ type: "connection", status, error });
  }, []);

  // A pasted/scan offer immediately becomes the real encrypted relay client.
  // The prop seam remains available for the host app's injected worker, while
  // an absent prop never pretends that the connection is ready.
  useEffect(() => {
    if (transport || !pairedOffer) {
      relayClientRef.current?.close(1000, "Transport replaced");
      relayClientRef.current = null;
      setPairedTransport(undefined);
      return;
    }
    let relay: ReturnType<typeof createMobileRelayTransport>;
    try {
      relay = createMobileRelayTransport({
        offer: pairedOffer,
        onStateChange: relayState => {
          if (relayState === "connecting") setConnection("reconnecting");
          else if (relayState === "open") setConnection("connected");
          else if (relayState === "idle" || relayState === "closed") setConnection("offline");
        },
      });
    } catch (error) {
      setConnection("offline", error instanceof Error ? error.message : String(error));
      return;
    }
    relayClientRef.current = relay.client;
    setPairedTransport(relay.transport);
    return () => {
      relay.client.close(1000, "Pairing changed");
      if (relayClientRef.current === relay.client) relayClientRef.current = null;
    };
  }, [pairedOffer, transport, setConnection]);

  const refreshProjects = useCallback(async (preferredProjectId?: string) => {
    if (!api) {
      setConnection("offline", "Attach the Caret host transport to connect to your Mac");
      return;
    }
    setConnection("connecting");
    try {
      const projects = await api.listProjects();
      dispatch({ type: "projects", projects });
      const current = preferredProjectId ?? stateRef.current.project?.id ?? projects[0]?.id;
      if (current) {
        const sessions = await api.listSessions(current);
        dispatch({ type: "sessions", sessions });
      }
      setConnection("connected");
    } catch (error) {
      setConnection("offline", error instanceof Error ? error.message : String(error));
    }
  }, [api, setConnection]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const catchUp = useCallback(async (sessionId = stateRef.current.session?.id) => {
    if (!api || !sessionId) return;
    const current = stateRef.current;
    const requestedSession = current.session;
    if (!requestedSession || requestedSession.id !== sessionId) return;
    const requestedIncarnation = requestedSession.incarnation;
    const isCurrentSession = () => {
      const live = stateRef.current.session;
      return live?.id === sessionId && live.incarnation === requestedIncarnation;
    };
    if (current.connection === "offline") setConnection("reconnecting");
    try {
      const page = await api.getEvents(sessionId, current.cursor, 200);
      if (!isCurrentSession()) return;
      dispatch({ type: "events", page, sessionId, incarnation: requestedIncarnation });
      const latest = stateRef.current;
      if (!isCurrentSession()) return;
      await cache.set(`caret.mobile.snapshot.v1:${encodeURIComponent(sessionId)}`, JSON.stringify(createCachedSnapshot(latest)));
      if (!isCurrentSession()) return;
      setConnection(latest.session?.status === "running" ? "running" : "connected");
      const pending = await api.getPendingUi(sessionId);
      if (!isCurrentSession()) return;
      // GET /ui is authoritative. It removes historical caret_ui rows that no
      // longer await an answer while preserving a mounted sheet for same-token
      // requests so an in-progress input is not replaced during polling.
      dispatch({ type: "ui_sync", events: pending });
    } catch (error) {
      setConnection("offline", error instanceof Error ? error.message : String(error));
    }
  }, [api, cache, setConnection]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", next => {
      if (next === "active") void catchUp();
    });
    return () => subscription.remove();
  }, [catchUp]);

  useEffect(() => {
    if (!api || !state.session) return;
    const timer = setInterval(() => void catchUp(stateRef.current.session?.id), 3_000);
    return () => clearInterval(timer);
  }, [api, catchUp, state.session?.id]);

  useEffect(() => {
    if (!state.session || state.events.length === 0) return;
    const snapshot = createCachedSnapshot(state);
    if (snapshot) void cache.set(`caret.mobile.snapshot.v1:${encodeURIComponent(snapshot.sessionId)}`, JSON.stringify(snapshot));
  }, [cache, state]);

  const selectProject = useCallback(async (project: Project) => {
    dispatch({ type: "project", project });
    if (!api) return;
    try {
      const sessions = await api.listSessions(project.id);
      dispatch({ type: "sessions", sessions });
    } catch (error) {
      setConnection("offline", error instanceof Error ? error.message : String(error));
    }
  }, [api, setConnection]);

  const selectSession = useCallback(async (session: Session) => {
    dispatch({ type: "session", session });
    const emptyState = stateRef.current;
    const cached = await readCachedSnapshot(cache, session);
    const selected = () => {
      const live = stateRef.current.session;
      return live?.id === session.id && live.incarnation === session.incarnation;
    };
    if (cached) {
      if (!selected()) return;
      dispatch({ type: "events", page: { events: [...cached.snapshot.events], cursor: cached.snapshot.cursor, hasMore: false }, sessionId: session.id, incarnation: session.incarnation });
      dispatch({ type: "cached_meta", savedAt: cached.snapshot.savedAt, expiresAt: cached.snapshot.expiresAt });
    }
    if (!api) return;
    await catchUp(session.id);
    if (!selected()) return;
    try {
      const commands = await api.getCommands(session.id);
      if (!selected()) return;
      for (const command of commands) ledgerRef.current.absorb(command);
      const latest = stateRef.current;
      for (const command of commands) dispatch({ type: "command_result", command });
      if (latest.connection === "offline") setConnection("connected");
    } catch {
      // Event catch-up already reports the user-visible connection problem.
    }
    void emptyState;
  }, [api, cache, catchUp, setConnection]);

  const artifactTargetIsCurrent = useCallback((target: { readonly id: string; readonly incarnation: string }) => {
    const current = stateRef.current.session;
    return current?.id === target.id && current.incarnation === target.incarnation;
  }, []);

  const refreshArtifacts = useCallback(async (target: { readonly id: string; readonly incarnation: string }) => {
    if (!api || !artifactTargetIsCurrent(target)) return;
    setArtifactBusy(true);
    setArtifactError(null);
    try {
      const listed = await api.listArtifacts(target.id);
      if (!artifactTargetIsCurrent(target)) return;
      setArtifacts(listed);
    } catch (error) {
      if (!artifactTargetIsCurrent(target)) return;
      setArtifactError(error instanceof Error ? error.message : String(error));
    } finally {
      if (artifactTargetIsCurrent(target)) setArtifactBusy(false);
    }
  }, [api, artifactTargetIsCurrent]);

  const openArtifacts = useCallback(() => {
    const session = stateRef.current.session;
    if (!api || !session) return;
    const target = { id: session.id, incarnation: session.incarnation } as const;
    setArtifactSession(target);
    setArtifacts([]);
    setArtifactError(null);
    setShowArtifacts(true);
    void refreshArtifacts(target);
  }, [api, refreshArtifacts]);

  const captureArtifact = useCallback(async (path: string, sourcePaths: readonly string[]) => {
    const target = artifactSession;
    if (!api || !target || !artifactTargetIsCurrent(target)) return;
    setArtifactBusy(true);
    setArtifactError(null);
    try {
      const receipt = await api.captureArtifact(target.id, path, sourcePaths);
      if (!artifactTargetIsCurrent(target)) return;
      setArtifacts(previous => [receipt, ...previous.filter(item => item.sha256 !== receipt.sha256)]);
      setShowArtifactCapture(false);
      setArtifactViewer(receipt);
    } catch (error) {
      if (!artifactTargetIsCurrent(target)) return;
      setArtifactError(error instanceof Error ? error.message : String(error));
    } finally {
      if (artifactTargetIsCurrent(target)) setArtifactBusy(false);
    }
  }, [api, artifactSession, artifactTargetIsCurrent]);

  const closeArtifacts = useCallback(() => {
    setShowArtifacts(false);
    setShowArtifactCapture(false);
    setArtifactViewer(null);
  }, []);

  const startSession = useCallback(async () => {
    const session = stateRef.current.session;
    if (!api || !session) return;
    setBusy(true);
    try {
      const started = await api.startSession(session.id);
      dispatch({ type: "session", session: started });
      setConnection("connected");
      await catchUp(started.id);
    } catch (error) {
      setConnection("offline", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [api, catchUp, setConnection]);

  const reconcileSession = useCallback(async () => {
    const session = stateRef.current.session;
    if (!api || !session || session.status !== "recovery_required") return;
    setBusy(true);
    try {
      const reconciled = await api.reconcile(session.id);
      dispatch({ type: "session", session: reconciled });
      setConnection("connected");
      await catchUp(session.id);
    } catch (error) {
      setConnection("offline", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [api, catchUp, setConnection]);

  const dispatchCommand = useCallback(async (input: { command: string; payload?: Record<string, Json>; commandId?: string; retryUnknown?: boolean }) => {
    const session = stateRef.current.session;
    if (!api || !session) return;
    let record;
    try {
      if (input.retryUnknown && input.commandId) {
        record = ledgerRef.current.retryUnknown(input.commandId, true);
      } else {
        record = ledgerRef.current.create({ commandId: input.commandId, incarnation: session.incarnation, command: input.command, payload: input.payload });
      }
    } catch (error) {
      Alert.alert("Command unavailable", error instanceof Error ? error.message : String(error));
      return;
    }
    dispatch({ type: "command_created", command: { commandId: record.commandId, incarnation: record.incarnation, command: record.command, payload: record.payload } });
    ledgerRef.current.mark(record.commandId, "sent");
    dispatch({ type: "command_status", commandId: record.commandId, status: "sent" });
    try {
      const command = await api.sendCommand(session.id, ledgerRef.current.request(record.commandId));
      ledgerRef.current.absorb(command);
      dispatch({ type: "command_result", command });
      if (command.status === "outcome_unknown") setConnection("unknown", command.error);
      else if (command.status === "acknowledged" || command.status === "claimed") setConnection("running");
      else await catchUp(session.id);
      if (input.command === "get_available_models") {
        const models = modelOptions(command);
        dispatch({ type: "models", models });
        setShowModelPicker(true);
      }
      if (input.command === "get_login_providers") {
        dispatch({ type: "login_providers", providers: loginProvidersFromCommand(command) });
        setShowLoginPicker(true);
      }
      if (input.command === "login" && (command.status === "completed" || command.status === "acknowledged" || command.status === "claimed")) {
        void dispatchCommand({ command: "get_login_providers" });
      }
    } catch (error) {
      ledgerRef.current.markUnknown(record.commandId, error instanceof Error ? error.message : String(error));
      dispatch({ type: "command_status", commandId: record.commandId, status: "unknown", error: error instanceof Error ? error.message : String(error) });
      setConnection("unknown", "The command outcome is unknown. Retry only from its card.");
    }
  }, [api, catchUp, setConnection]);

  const sendPrompt = useCallback(() => {
    const message = sanitizeText(stateRef.current.draft);
    if (!message) return;
    dispatch({ type: "draft", draft: "" });
    void dispatchCommand({ command: "prompt", payload: { message } });
  }, [dispatchCommand]);

  const sendTerminalInput = useCallback((identity: VirtualTerminalIdentity, data: string) => {
    const current = stateRef.current;
    const terminal = current.virtualTerminals.find(item => item.terminalId === identity.terminalId);
    if (!current.session || current.session.id !== identity.sessionId || current.session.incarnation !== identity.incarnation || !terminal || terminal.closed) return;
    try {
      const command = terminalInputCommand(identity.terminalId, data);
      void dispatchCommand(command);
    } catch (error) {
      Alert.alert("Terminal input unavailable", error instanceof Error ? error.message : String(error));
    }
  }, [dispatchCommand]);

  const sendTerminalResize = useCallback((identity: VirtualTerminalIdentity, cols: number, rows: number) => {
    const current = stateRef.current;
    const terminal = current.virtualTerminals.find(item => item.terminalId === identity.terminalId);
    if (!current.session || current.session.id !== identity.sessionId || current.session.incarnation !== identity.incarnation || !terminal || terminal.closed) return;
    try {
      const command = terminalResizeCommand(identity.terminalId, cols, rows);
      void dispatchCommand(command);
    } catch (error) {
      Alert.alert("Terminal resize unavailable", error instanceof Error ? error.message : String(error));
    }
  }, [dispatchCommand]);

  const sendTerminalNegotiate = useCallback((identity: VirtualTerminalIdentity, cols: number, rows: number) => {
    const current = stateRef.current;
    const terminal = current.virtualTerminals.find(item => item.terminalId === identity.terminalId);
    if (!current.session || current.session.id !== identity.sessionId || current.session.incarnation !== identity.incarnation || !terminal || terminal.closed) return;
    try {
      // Negotiation has no terminalId by design: OMP owns the single virtual
      // terminal for the negotiated session. The identity guard above keeps a
      // stale WebView from negotiating a newer session/incarnation.
      const command = terminalNegotiateCommand(cols, rows);
      void dispatchCommand(command);
    } catch (error) {
      Alert.alert("Terminal recovery unavailable", error instanceof Error ? error.message : String(error));
    }
  }, [dispatchCommand]);

  const sendUiResponse = useCallback(async (request: PendingUiRequest, answer: UiResponseRequest["answer"]) => {
    const session = stateRef.current.session;
    if (!api || !session) return;
    const commandId = createCommandId("ui");
    const body: UiResponseRequest = { commandId, incarnation: session.incarnation, token: request.token, answer };
    dispatch({ type: "command_created", command: { commandId, incarnation: session.incarnation, command: "ui_response", payload: jsonRecord({ token: request.token, answer }) } });
    try {
      const command = await api.sendUiResponse(session.id, body);
      dispatch({ type: "ui_resolved", token: request.token });
      if (command) dispatch({ type: "command_result", command });
    } catch (error) {
      dispatch({ type: "command_status", commandId, status: "unknown", error: error instanceof Error ? error.message : String(error) });
      Alert.alert("Response unavailable", "The interaction may still be pending on the Mac. Refresh before answering again.");
    }
  }, [api]);

  const toggleProjectPinned = useCallback(async (project: Project) => {
    dispatch({ type: "projects", projects: stateRef.current.projects.map(item => item.id === project.id ? { ...item, pinned: !item.pinned } : item) });
    if (api) {
      try { await api.patchProject(project.id, { pinned: !project.pinned }); } catch (error) { setConnection("offline", error instanceof Error ? error.message : String(error)); }
    }
  }, [api, setConnection]);

  const toggleProjectArchived = useCallback(async (project: Project) => {
    dispatch({ type: "projects", projects: stateRef.current.projects.map(item => item.id === project.id ? { ...item, archived: !item.archived } : item) });
    if (api) {
      try { await api.patchProject(project.id, { archived: !project.archived }); } catch (error) { setConnection("offline", error instanceof Error ? error.message : String(error)); }
    }
  }, [api, setConnection]);

  const toggleSessionArchived = useCallback(async (session: Session) => {
    dispatch({ type: "sessions", sessions: stateRef.current.sessions.map(item => item.id === session.id ? { ...item, archived: !item.archived } : item) });
    if (api) {
      try { await api.patchSession(session.id, { archived: !session.archived }); } catch (error) { setConnection("offline", error instanceof Error ? error.message : String(error)); }
    }
  }, [api, setConnection]);

  const toggleSessionPinned = useCallback(async (session: Session) => {
    dispatch({ type: "sessions", sessions: stateRef.current.sessions.map(item => item.id === session.id ? { ...item, pinned: !item.pinned } : item) });
    if (api) {
      try { await api.patchSession(session.id, { pinned: !session.pinned }); } catch (error) { setConnection("offline", error instanceof Error ? error.message : String(error)); }
    }
  }, [api, setConnection]);

  const openLoginUrl = useCallback(async (url: string) => {
    if (!isSafeExternalUrl(url)) {
      Alert.alert("Link blocked", "Caret only opens http or https login URLs.");
      return;
    }
    try {
      const allowed = await Linking.canOpenURL(url);
      if (!allowed) {
        Alert.alert("Cannot open link", url);
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Cannot open link", error instanceof Error ? error.message : String(error));
    }
  }, []);

  const importOffer = useCallback(async (offer: PairingOffer) => {
    try {
      await savePairingSecrets(secretStore, offer);
      setPairedOffer(offer);
      setShowPairing(false);
      Alert.alert("Mac paired", "Your credentials stay protected on this phone. Caret will keep the same Mac workspace available here.");
    } catch (error) {
      Alert.alert("Pairing failed", error instanceof Error ? error.message : String(error));
    }
  }, [secretStore]);

  const activeUi = state.uiRequests[0];
  const selectedProject = state.project ?? state.projects[0] ?? null;
  const projectSessions = state.sessions.filter(session => session.projectId === selectedProject?.id);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>⌁</Text></View>
          <View><Text style={styles.brand}>Caret</Text><Text style={styles.brandCaption}>your work, in motion</Text></View>
        </View>
        <Pressable onPress={() => setShowPairing(true)} accessibilityRole="button" accessibilityLabel="Open Mac connection">
          <View style={styles.connectionPill}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(state.connection, palette) }]} />
            <Text style={styles.connectionText}>{state.connection === "offline" ? "Offline" : state.connection === "running" ? "Working" : state.connection[0]!.toUpperCase() + state.connection.slice(1)}</Text>
          </View>
        </Pressable>
      </View>

      {state.session ? (
        <TaskDetail
          state={state}
          styles={styles}
          palette={palette}
          busy={busy}
          onBack={() => dispatch({ type: "session", session: null })}
          onStart={startSession}
          onReconcile={reconcileSession}
          onSendPrompt={sendPrompt}
          onDraft={draft => dispatch({ type: "draft", draft })}
          onCommand={command => void dispatchCommand(command)}
          onRetry={commandId => void dispatchCommand({ command: "prompt", commandId, retryUnknown: true })}
          onOpenModels={() => { void dispatchCommand({ command: "get_available_models" }); }}
          onOpenLogin={() => { void dispatchCommand({ command: "get_login_providers" }); }}
          onStartLogin={providerId => { void dispatchCommand({ command: "login", payload: { providerId } }); }}
          onOpenLoginUrl={url => { void openLoginUrl(url); }}
          onOpenArtifacts={openArtifacts}
          onSelectModel={model => {
            if (!model.provider) { Alert.alert("Model unavailable", "OMP did not provide a provider id for this model."); return; }
            setShowModelPicker(false);
            void dispatchCommand({ command: "set_model", payload: { provider: model.provider, modelId: model.id } });
          }}
          models={state.models}
          showModelPicker={showModelPicker}
          setShowModelPicker={setShowModelPicker}
          showLoginPicker={showLoginPicker}
          setShowLoginPicker={setShowLoginPicker}
          onTerminalInput={sendTerminalInput}
          onTerminalResize={sendTerminalResize}
          onTerminalNegotiate={sendTerminalNegotiate}
        />
      ) : (
        <Dashboard
          state={state}
          styles={styles}
          palette={palette}
          selectedView={selectedView}
          setSelectedView={setSelectedView}
          selectedProject={selectedProject}
          projectSessions={projectSessions}
          onSelectProject={selectProject}
          onSearch={query => dispatch({ type: "search", query })}
          onShowArchived={() => dispatch({ type: "show_archived", value: !stateRef.current.showArchived })}
          onSelectSession={selectSession}
          onPinSession={toggleSessionPinned}
          onPinProject={toggleProjectPinned}
          onArchiveProject={toggleProjectArchived}
          onArchiveSession={toggleSessionArchived}
          onRefresh={() => void refreshProjects(selectedProject?.id)}
          onOpenPairing={() => setShowPairing(true)}
        />
      )}
      {pairedOffer && !transport && !pairedTransport ? <Text style={styles.pairedHint}>Mac paired · connecting securely…</Text> : null}
      {activeUi ? <UiSheet request={activeUi} styles={styles} palette={palette} visible onClose={() => undefined} onAnswer={answer => void sendUiResponse(activeUi, answer)} /> : null}
      {artifactSession ? <ArtifactSheet visible={showArtifacts} styles={styles} palette={palette} session={state.session && state.session.id === artifactSession.id ? state.session : null} artifacts={artifacts} loading={artifactBusy} error={artifactError} onClose={closeArtifacts} onRefresh={() => void refreshArtifacts(artifactSession)} onCapture={() => setShowArtifactCapture(true)} onSelect={receipt => setArtifactViewer(receipt)} /> : null}
      {artifactSession ? <ArtifactCaptureSheet visible={showArtifactCapture} styles={styles} palette={palette} loading={artifactBusy} error={artifactError} onClose={() => setShowArtifactCapture(false)} onSubmit={(path, sourcePaths) => void captureArtifact(path, sourcePaths)} /> : null}
      {artifactSession && artifactViewer ? <ArtifactViewer visible={Boolean(artifactViewer)} styles={styles} palette={palette} api={api} receipt={artifactViewer} target={artifactSession} isCurrent={artifactTargetIsCurrent} onClose={() => setArtifactViewer(null)} /> : null}
      <PairingSheet visible={showPairing} styles={styles} palette={palette} onClose={() => setShowPairing(false)} onImport={offer => void importOffer(offer)} />
    </View>
  );
}

function Dashboard(props: {
  state: MobileTaskState;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  selectedView: "tasks" | "projects";
  setSelectedView: (value: "tasks" | "projects") => void;
  selectedProject: Project | null;
  projectSessions: readonly Session[];
  onSelectProject: (project: Project) => void;
  onSearch: (query: string) => void;
  onShowArchived: () => void;
  onSelectSession: (session: Session) => void;
  onPinSession: (session: Session) => void;
  onPinProject: (project: Project) => void;
  onArchiveProject: (project: Project) => void;
  onArchiveSession: (session: Session) => void;
  onRefresh: () => void;
  onOpenPairing: () => void;
}) {
  const { state, styles, palette } = props;
  const projects = state.projects.filter(project => state.showArchived || !project.archived).filter(project => {
    const q = state.searchQuery.trim().toLowerCase();
    return !q || `${project.name} ${project.path}`.toLowerCase().includes(q);
  });
  const sessions = props.projectSessions.filter(session => state.showArchived || !session.archived).filter(session => {
    const q = state.searchQuery.trim().toLowerCase();
    return !q || session.title.toLowerCase().includes(q);
  });
  return (
    <ScrollView contentContainerStyle={styles.dashboard} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MAC WORKSPACE</Text>
        <Text style={styles.heroTitle}>Keep the thread.</Text>
        <Text style={styles.heroBody}>Continue the same OMP session from the desk or the road.</Text>
      </View>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={state.searchQuery} onChangeText={props.onSearch} placeholder="Search projects and tasks" placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel="Search projects and tasks" />
      </View>
      <View style={styles.segmented}>
        <Pressable onPress={() => props.setSelectedView("tasks")} style={[styles.segment, props.selectedView === "tasks" && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: props.selectedView === "tasks" }}><Text style={[styles.segmentText, props.selectedView === "tasks" && styles.segmentTextActive]}>Tasks</Text></Pressable>
        <Pressable onPress={() => props.setSelectedView("projects")} style={[styles.segment, props.selectedView === "projects" && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: props.selectedView === "projects" }}><Text style={[styles.segmentText, props.selectedView === "projects" && styles.segmentTextActive]}>Projects</Text></Pressable>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{props.selectedView === "tasks" ? (props.selectedProject?.name ?? "Tasks") : "Projects"}</Text>
        <View style={styles.rowGap}>
          <Pressable onPress={props.onShowArchived} accessibilityRole="button"><Text style={styles.linkText}>{state.showArchived ? "Hide archived" : "Show archived"}</Text></Pressable>
          <Pressable onPress={props.onRefresh} accessibilityRole="button" accessibilityLabel="Refresh workspace"><Text style={styles.refresh}>↻</Text></Pressable>
        </View>
      </View>
      {props.selectedView === "projects" ? (
        projects.length ? projects.map(project => <ProjectCard key={project.id} project={project} styles={styles} palette={palette} selected={project.id === props.selectedProject?.id} onSelect={() => props.onSelectProject(project)} onPin={() => props.onPinProject(project)} onArchive={() => props.onArchiveProject(project)} />) : <EmptyState styles={styles} palette={palette} title="No projects yet" body="Projects created on your Mac will appear here." onAction={props.onOpenPairing} action="Connect your Mac" />
      ) : (
        <>
          {props.selectedProject ? <ProjectCard project={props.selectedProject} styles={styles} palette={palette} selected onSelect={() => props.setSelectedView("projects")} onPin={() => props.onPinProject(props.selectedProject!)} onArchive={() => props.onArchiveProject(props.selectedProject!)} compact /> : null}
          {sessions.length ? sessions.map(session => <SessionCard key={session.id} session={session} styles={styles} palette={palette} onSelect={() => props.onSelectSession(session)} onPin={() => props.onPinSession(session)} onArchive={() => props.onArchiveSession(session)} />) : <EmptyState styles={styles} palette={palette} title="No tasks in this project" body="Start a session on your Mac to see it here." onAction={props.onOpenPairing} action="Connect your Mac" />}
        </>
      )}
      {!state.projects.length && !props.state.lastError ? <View style={styles.unavailable}><Text style={styles.unavailableTitle}>Waiting for your Mac</Text><Text style={styles.unavailableBody}>Pair your Mac to continue the same workspace from this phone.</Text><Pressable onPress={props.onOpenPairing} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Open connection</Text></Pressable></View> : null}
      {state.lastError ? <Text style={styles.errorText}>{state.lastError}</Text> : null}
    </ScrollView>
  );
}

function ProjectCard(props: { project: Project; styles: ReturnType<typeof makeStyles>; palette: Palette; selected?: boolean; compact?: boolean; onSelect: () => void; onPin: () => void; onArchive: () => void }) {
  const { project, styles, palette } = props;
  return <View style={[styles.card, props.selected && styles.cardSelected, props.compact && styles.cardCompact]}><Pressable onPress={props.onSelect} style={styles.cardMain} accessibilityRole="button" accessibilityLabel={`Open project ${project.name}`}><View style={styles.projectGlyph}><Text style={styles.projectGlyphText}>{project.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={1}>{project.name}</Text><Text style={styles.cardSubtitle} numberOfLines={1}>{project.path}</Text></View></Pressable><View style={styles.cardActions}><Pressable onPress={props.onPin} accessibilityRole="button" accessibilityLabel={project.pinned ? `Unpin ${project.name}` : `Pin ${project.name}`}><Text style={[styles.actionIcon, project.pinned && { color: palette.accent }]}>{project.pinned ? "★" : "☆"}</Text></Pressable><Pressable onPress={props.onArchive} accessibilityRole="button" accessibilityLabel={project.archived ? `Restore ${project.name}` : `Archive ${project.name}`}><Text style={styles.actionIcon}>{project.archived ? "↩" : "…"}</Text></Pressable></View></View>;
}

function SessionCard(props: { session: Session; styles: ReturnType<typeof makeStyles>; palette: Palette; onSelect: () => void; onPin: () => void; onArchive: () => void }) {
  const { session, styles, palette } = props;
  const running = session.status === "running";
  return <View style={styles.card}><Pressable onPress={props.onSelect} style={styles.cardMain} accessibilityRole="button" accessibilityLabel={`Open task ${session.title}`}><View style={[styles.taskGlyph, { backgroundColor: running ? palette.accentSoft : palette.elevated }]}><Text style={[styles.taskGlyphText, { color: running ? palette.accent : palette.muted }]}>{running ? "•" : "›"}</Text></View><View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={1}>{session.title}</Text><Text style={styles.cardSubtitle}>{running ? "Working now" : session.status === "recovery_required" ? "Needs reconciliation" : `Updated ${formatRelativeTime(session.updatedAt)}`}</Text></View></Pressable><View style={styles.cardActions}><Pressable onPress={props.onPin} accessibilityRole="button" accessibilityLabel={session.pinned ? `Unpin ${session.title}` : `Pin ${session.title}`}><Text style={[styles.actionIcon, session.pinned && { color: palette.accent }]}>{session.pinned ? "★" : "☆"}</Text></Pressable><Pressable onPress={props.onArchive} accessibilityRole="button" accessibilityLabel={session.archived ? "Restore task" : "Archive task"}><Text style={styles.actionIcon}>{session.archived ? "↩" : "…"}</Text></Pressable></View></View>;
}

function EmptyState(props: { styles: ReturnType<typeof makeStyles>; palette: Palette; title: string; body: string; action: string; onAction: () => void }) {
  return <View style={props.styles.empty}><View style={props.styles.emptyMark}><Text style={props.styles.emptyMarkText}>⌁</Text></View><Text style={props.styles.emptyTitle}>{props.title}</Text><Text style={props.styles.emptyBody}>{props.body}</Text><Pressable onPress={props.onAction} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>{props.action}</Text></Pressable></View>;
}

function TaskDetail(props: {
  state: MobileTaskState;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  busy: boolean;
  models: readonly ModelOption[];
  showModelPicker: boolean;
  setShowModelPicker: (value: boolean) => void;
  showLoginPicker: boolean;
  setShowLoginPicker: (value: boolean) => void;
  onBack: () => void;
  onStart: () => void;
  onReconcile: () => void;
  onSendPrompt: () => void;
  onDraft: (value: string) => void;
  onCommand: (input: { command: string; payload?: Record<string, Json> }) => void;
  onRetry: (commandId: string) => void;
  onOpenModels: () => void;
  onOpenLogin: () => void;
  onStartLogin: (providerId: string) => void;
  onOpenLoginUrl: (url: string) => void;
  onOpenArtifacts: () => void;
  onSelectModel: (model: ModelOption) => void;
  onTerminalInput: (identity: VirtualTerminalIdentity, data: string) => void;
  onTerminalResize: (identity: VirtualTerminalIdentity, cols: number, rows: number) => void;
  onTerminalNegotiate: (identity: VirtualTerminalIdentity, cols: number, rows: number) => void;
}) {
  const { state, styles, palette } = props;
  const session = state.session!;
  const inputRef = useRef<TextInput>(null);
  const [composerHeight, setComposerHeight] = useState(48);
  const hasUnknown = Object.values(state.pendingCommands).some(command => command.status === "unknown");
  return <KeyboardAvoidingView style={styles.detailRoot} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={10}>
    <View style={styles.detailHeader}><Pressable onPress={props.onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to tasks"><Text style={styles.backText}>‹</Text></Pressable><View style={styles.detailTitleWrap}><Text style={styles.detailTitle} numberOfLines={1}>{session.title}</Text><Text style={styles.detailSubtitle}>{session.status === "running" ? "Working on Mac" : session.status === "recovery_required" ? "Outcome needs review" : "OMP session"}</Text></View><View style={styles.detailActions}><Pressable onPress={props.onOpenArtifacts} style={styles.artifactButton} accessibilityRole="button" accessibilityLabel="Open artifacts"><Text style={styles.artifactButtonText}>Files</Text></Pressable><Pressable onPress={props.onOpenLogin} style={styles.artifactButton} accessibilityRole="button" accessibilityLabel="OMP login"><Text style={styles.artifactButtonText}>Login</Text></Pressable><Pressable onPress={props.onOpenModels} style={styles.modelButton} accessibilityRole="button" accessibilityLabel="Choose model"><Text style={styles.modelButtonText}>{state.selectedModel ?? "Model"}</Text><Text style={styles.modelChevron}>⌄</Text></Pressable></View></View>
    <ScrollView style={styles.transcript} contentContainerStyle={styles.transcriptContent} keyboardShouldPersistTaps="handled">
      {session.status === "recovery_required" ? <View style={styles.sessionStart}><Text style={styles.sessionStartTitle}>Review this session</Text><Text style={styles.sessionStartBody}>The Mac reported an unknown command outcome. Check the Mac first, then reconcile this session before starting it again.</Text><Pressable onPress={props.onReconcile} disabled={props.busy || state.connection === "offline"} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{props.busy ? "Reconciling…" : "Reconcile session"}</Text></Pressable></View> : null}
      {session.status !== "running" && session.status !== "recovery_required" && !state.transcript.length ? <View style={styles.sessionStart}><Text style={styles.sessionStartTitle}>Ready when you are</Text><Text style={styles.sessionStartBody}>This session runs on your Mac. Start it once, then continue from anywhere.</Text><Pressable onPress={props.onStart} disabled={props.busy || !state.connection || state.connection === "offline"} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{props.busy ? "Starting…" : "Start session"}</Text></Pressable></View> : null}
      <VirtualTerminalPanel sessionId={session.id} incarnation={session.incarnation} terminals={state.virtualTerminals} palette={palette} onInput={props.onTerminalInput} onResize={props.onTerminalResize} onNegotiate={props.onTerminalNegotiate} />
      {state.transcript.filter(entry => entry.kind !== "event" || entry.status === "failed").map(entry => <TranscriptCard key={entry.id} entry={entry} styles={styles} palette={palette} />)}
      {hasUnknown ? <View style={styles.warningBanner}><Text style={styles.warningTitle}>Some command outcomes are unknown</Text><Text style={styles.warningBody}>Caret will not replay them automatically. Check the Mac, then retry an individual command deliberately.</Text>{Object.values(state.pendingCommands).filter(command => command.status === "unknown").map(command => <Pressable key={command.commandId} onPress={() => props.onRetry(command.commandId)} style={styles.warningAction}><Text style={styles.warningActionText}>Retry {command.command}</Text></Pressable>)}</View> : null}
    </ScrollView>
    <View style={styles.composerBar}><View style={styles.composerRow}><TextInput ref={inputRef} value={state.draft} onChangeText={props.onDraft} style={[styles.composerInput, { minHeight: composerHeight }]} onContentSizeChange={event => setComposerHeight(Math.min(132, Math.max(48, event.nativeEvent.contentSize.height)))} multiline blurOnSubmit={false} returnKeyType="default" placeholder="Ask Caret to continue…" placeholderTextColor={palette.muted} accessibilityLabel="Message Caret"/><Pressable onPress={props.onSendPrompt} disabled={!sanitizeText(state.draft) || state.connection === "offline"} style={[styles.sendButton, (!sanitizeText(state.draft) || state.connection === "offline") && styles.buttonDisabled]} accessibilityRole="button" accessibilityLabel="Send message"><Text style={styles.sendText}>↑</Text></Pressable></View><View style={styles.composerActions}><Pressable onPress={() => props.onCommand({ command: "abort", payload: {} })} disabled={state.connection !== "running" || props.busy} style={styles.composerAction} accessibilityRole="button"><Text style={styles.composerActionText}>Stop</Text></Pressable><Pressable onPress={() => props.onCommand({ command: "steer", payload: { message: state.draft.trim() } })} disabled={state.connection !== "running" || !state.draft.trim() || props.busy} style={styles.composerAction} accessibilityRole="button"><Text style={styles.composerActionText}>Steer</Text></Pressable><Pressable onPress={() => props.onCommand({ command: "follow_up", payload: { message: state.draft.trim() } })} disabled={state.connection !== "running" || !state.draft.trim() || props.busy} style={styles.composerAction} accessibilityRole="button"><Text style={styles.composerActionText}>Follow up</Text></Pressable></View></View>
    <ModelPicker visible={props.showModelPicker} models={props.models} selected={state.selectedModel} styles={styles} palette={palette} onClose={() => props.setShowModelPicker(false)} onSelect={props.onSelectModel} onRefresh={props.onOpenModels} />
    <LoginPicker visible={props.showLoginPicker} providers={state.loginProviders} presentations={state.presentations} styles={styles} palette={palette} onClose={() => props.setShowLoginPicker(false)} onRefresh={props.onOpenLogin} onStartLogin={props.onStartLogin} onOpenUrl={props.onOpenLoginUrl} />
  </KeyboardAvoidingView>;
}

function TranscriptCard(props: { entry: TranscriptEntry; styles: ReturnType<typeof makeStyles>; palette: Palette }) {
  const { entry, styles, palette } = props;
  if (entry.kind === "tool") return <View style={styles.toolCard}><View style={styles.toolHeader}><View style={styles.toolIcon}><Text style={styles.toolIconText}>✦</Text></View><Text style={styles.toolName}>{entry.toolName ?? "Tool"}</Text><Text style={[styles.toolStatus, { color: entry.toolStatus === "failed" ? palette.danger : entry.toolStatus === "running" ? palette.warning : palette.success }]}>{entry.toolStatus ?? "unknown"}</Text></View>{entry.args ? <Text style={styles.toolArgs} numberOfLines={4}>{JSON.stringify(entry.args, null, 2)}</Text> : null}{entry.output ? <Text style={styles.toolOutput}>{entry.output}</Text> : null}</View>;
  if (entry.kind === "event") return <View style={styles.eventRow}><Text style={styles.eventDot}>·</Text><Text style={styles.eventText}>{entry.text}</Text></View>;
  return <View style={[styles.messageCard, entry.role === "user" && styles.userMessage]}><Text style={styles.messageRole}>{entry.role === "user" ? "You" : entry.role === "system" ? "Caret" : "Caret"}</Text><Text style={styles.messageText}>{entry.text || "…"}</Text>{entry.status === "streaming" ? <ActivityIndicator size="small" color={palette.accent} style={styles.streaming} /> : null}</View>;
}

function ArtifactSheet(props: {
  visible: boolean;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  session: Session | null;
  artifacts: readonly ArtifactReceipt[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onCapture: () => void;
  onSelect: (receipt: ArtifactReceipt) => void;
}) {
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
    <View style={props.styles.modalBackdrop}><View style={props.styles.artifactSheet}><View style={props.styles.sheetHandle} /><View style={props.styles.sheetHeader}><View><Text style={props.styles.sheetKicker}>IMMUTABLE OUTPUTS</Text><Text style={props.styles.sheetTitle}>Artifacts</Text><Text style={props.styles.artifactSession} numberOfLines={1}>{props.session?.title ?? "Current task"}</Text></View><Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close artifacts"><Text style={props.styles.closeText}>×</Text></Pressable></View><Text style={props.styles.uiMessage}>Captured copies stay tied to this task. Caret never uploads a workspace file until you choose Capture.</Text>{props.loading ? <View style={props.styles.artifactLoading}><ActivityIndicator color={props.palette.accent} /><Text style={props.styles.artifactMeta}>Loading artifacts…</Text></View> : null}{props.error ? <Text style={props.styles.errorText}>{props.error}</Text> : null}<ScrollView style={props.styles.artifactList} contentContainerStyle={props.styles.artifactListContent}>{props.artifacts.length ? props.artifacts.map(receipt => <Pressable key={receipt.sha256} onPress={() => props.onSelect(receipt)} style={props.styles.artifactRow} accessibilityRole="button" accessibilityLabel={`Preview artifact ${receipt.name}`}><View style={props.styles.artifactGlyph}><Text style={props.styles.artifactGlyphText}>{artifactKindLabel(artifactKind(receipt)).slice(0, 1)}</Text></View><View style={props.styles.artifactCopy}><Text style={props.styles.artifactTitle} numberOfLines={1}>{receipt.name}</Text><Text style={props.styles.artifactMeta} numberOfLines={1}>{artifactKindLabel(artifactKind(receipt))} · {artifactDisplaySize(receipt.size)}</Text><Text style={props.styles.artifactSource} numberOfLines={1}>{receipt.sourcePath}</Text></View><Text style={props.styles.artifactChevron}>›</Text></Pressable>) : <View style={props.styles.artifactEmpty}><Text style={props.styles.emptyTitle}>No captured artifacts</Text><Text style={props.styles.emptyBody}>Capture a file from the Mac when you want to keep an immutable copy here.</Text></View>}</ScrollView><View style={props.styles.artifactActions}><Pressable onPress={props.onRefresh} style={props.styles.secondaryButton} accessibilityRole="button"><Text style={props.styles.secondaryButtonText}>Refresh</Text></Pressable><Pressable onPress={props.onCapture} style={props.styles.primaryButton} accessibilityRole="button"><Text style={props.styles.primaryButtonText}>Capture file</Text></Pressable></View></View></View>
  </Modal>;
}

function ArtifactCaptureSheet(props: {
  visible: boolean;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (path: string, sourcePaths: readonly string[]) => void;
}) {
  const [path, setPath] = useState("");
  const [sourcePaths, setSourcePaths] = useState("");
  useEffect(() => {
    if (!props.visible) {
      setPath("");
      setSourcePaths("");
    }
  }, [props.visible]);
  const submit = () => {
    const artifactPath = path.trim();
    if (!artifactPath) return;
    const sources = sourcePaths.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
    props.onSubmit(artifactPath, sources);
  };
  return <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}><View style={props.styles.modalBackdrop}><View style={props.styles.uiSheet}><View style={props.styles.sheetHeader}><View><Text style={props.styles.sheetKicker}>EXPLICIT CAPTURE</Text><Text style={props.styles.sheetTitle}>Capture a file</Text></View><Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close capture"><Text style={props.styles.closeText}>×</Text></Pressable></View><Text style={props.styles.uiMessage}>Enter a path relative to the task workspace. Caret copies the bytes on your Mac and records their source hashes.</Text><TextInput value={path} onChangeText={setPath} style={props.styles.artifactInput} placeholder="dist/demo.mp4" placeholderTextColor={props.palette.muted} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Artifact path" /><TextInput value={sourcePaths} onChangeText={setSourcePaths} style={[props.styles.artifactInput, props.styles.artifactSourcesInput]} placeholder="Optional source paths, one per line" placeholderTextColor={props.palette.muted} autoCapitalize="none" autoCorrect={false} multiline accessibilityLabel="Artifact source paths" />{props.error ? <Text style={props.styles.errorText}>{props.error}</Text> : null}<View style={props.styles.uiActions}><Pressable onPress={props.onClose} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable onPress={submit} disabled={!path.trim() || props.loading} style={[props.styles.primaryButton, (!path.trim() || props.loading) && props.styles.buttonDisabled]}><Text style={props.styles.primaryButtonText}>{props.loading ? "Capturing…" : "Capture copy"}</Text></Pressable></View></View></View></Modal>;
}

function ArtifactViewer(props: {
  visible: boolean;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  api: CaretApi | null;
  receipt: ArtifactReceipt;
  target: { readonly id: string; readonly incarnation: string };
  isCurrent: (target: { readonly id: string; readonly incarnation: string }) => boolean;
  onClose: () => void;
}) {
  const kind = artifactKind(props.receipt);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!props.visible) return;
    const controller = new AbortController();
    let active = true;
    setBytes(null);
    setError(null);
    if (!props.api || !props.isCurrent(props.target)) {
      setError("This task is no longer selected");
      return () => controller.abort();
    }
    setLoading(true);
    void readArtifactBytes(props.api, props.receipt, { maxBytes: kind === "text" ? 2 * 1024 * 1024 : undefined, signal: controller.signal }).then(value => {
      if (!active || controller.signal.aborted || !props.isCurrent(props.target)) return;
      setBytes(value);
    }).catch(cause => {
      if (!active || controller.signal.aborted || !props.isCurrent(props.target)) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => {
      if (active && !controller.signal.aborted && props.isCurrent(props.target)) setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [kind, props.api, props.isCurrent, props.receipt, props.target, props.visible]);

  const download = useCallback(async () => {
    if (!bytes) return;
    try {
      await downloadArtifact(props.receipt, bytes, Platform.OS === "web" ? "web" : "native");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [bytes, props.receipt]);

  const uri = bytes ? artifactDataUri(props.receipt, bytes) : "";
  let preview: React.ReactNode = null;
  if (loading) preview = <View style={props.styles.artifactLoading}><ActivityIndicator color={props.palette.accent} /><Text style={props.styles.artifactMeta}>Verifying immutable bytes…</Text></View>;
  else if (error) preview = <Text style={props.styles.errorText}>{error}</Text>;
  else if (bytes && kind === "text") preview = <ScrollView style={props.styles.artifactPreview} contentContainerStyle={props.styles.artifactPreviewContent}><Text selectable style={props.styles.artifactText}>{decodeUtf8(bytes)}</Text></ScrollView>;
  else if (bytes && kind === "image") preview = Platform.OS === "web" ? React.createElement("img", { src: uri, alt: props.receipt.name, style: { maxWidth: "100%", maxHeight: 360, objectFit: "contain" } }) : <Image source={{ uri }} style={props.styles.artifactImage} resizeMode="contain" accessibilityLabel={props.receipt.name} />;
  else if (bytes && (kind === "audio" || kind === "video")) preview = Platform.OS === "web" ? React.createElement(kind, { src: uri, controls: true, playsInline: true, style: { width: "100%", maxHeight: 360 } }) : <WebView source={{ html: artifactMediaDocument(uri, kind, props.receipt.name) }} javaScriptEnabled={false} domStorageEnabled={false} originWhitelist={["*"]} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction style={props.styles.artifactMedia} />;
  else if (bytes) preview = <View style={props.styles.artifactEmpty}><Text style={props.styles.emptyTitle}>Preview unavailable</Text><Text style={props.styles.emptyBody}>This binary file is verified and ready for an explicit download.</Text></View>;

  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={props.styles.modalBackdrop}><View style={props.styles.artifactViewer}><View style={props.styles.sheetHeader}><View style={props.styles.artifactCopy}><Text style={props.styles.sheetKicker}>{artifactKindLabel(kind).toUpperCase()} ARTIFACT</Text><Text style={props.styles.sheetTitle} numberOfLines={1}>{props.receipt.name}</Text><Text style={props.styles.artifactMeta}>{artifactDisplaySize(props.receipt.size)} · {props.receipt.sha256.slice(0, 12)}…</Text></View><Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close artifact preview"><Text style={props.styles.closeText}>×</Text></Pressable></View>{preview}<View style={props.styles.artifactActions}><Pressable onPress={props.onClose} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Close</Text></Pressable><Pressable onPress={() => void download()} disabled={!bytes || loading} style={[props.styles.primaryButton, (!bytes || loading) && props.styles.buttonDisabled]} accessibilityRole="button"><Text style={props.styles.primaryButtonText}>{Platform.OS === "web" ? "Download" : "Share / save"}</Text></Pressable></View></View></View></Modal>;
}

function ModelPicker(props: { visible: boolean; models: readonly ModelOption[]; selected?: string; styles: ReturnType<typeof makeStyles>; palette: Palette; onClose: () => void; onSelect: (model: ModelOption) => void; onRefresh: () => void }) {
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={props.styles.modalBackdrop}><View style={props.styles.sheet}><View style={props.styles.sheetHandle} /><View style={props.styles.sheetHeader}><Text style={props.styles.sheetTitle}>Choose a model</Text><Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close model picker"><Text style={props.styles.closeText}>×</Text></Pressable></View>{props.models.length ? props.models.map(model => <Pressable key={`${model.provider ?? ""}:${model.id}`} onPress={() => props.onSelect(model)} style={props.styles.modelRow} accessibilityRole="button" accessibilityState={{ selected: model.id === props.selected }}><View style={props.styles.modelCopy}><Text style={props.styles.modelLabel}>{model.label}</Text><Text style={props.styles.modelMeta}>{model.provider ?? "Provider not advertised"}</Text></View><Text style={props.styles.modelCheck}>{model.id === props.selected ? "✓" : ""}</Text></Pressable>) : <View style={props.styles.emptySheet}><Text style={props.styles.emptyBody}>Ask OMP for its available model catalog.</Text><Pressable onPress={props.onRefresh} style={props.styles.primaryButton}><Text style={props.styles.primaryButtonText}>Refresh models</Text></Pressable></View>}<Text style={props.styles.sheetFootnote}>Models and availability come from OMP on the Mac.</Text></View></View></Modal>;
}

function LoginPicker(props: {
  visible: boolean;
  providers: readonly LoginProviderOption[];
  presentations: readonly UiPresentation[];
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  onRefresh: () => void;
  onStartLogin: (providerId: string) => void;
  onOpenUrl: (url: string) => void;
}) {
  const urls = props.presentations.filter(item => item.method === "open_url" && item.url);
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={props.styles.modalBackdrop}><View style={props.styles.sheet}><View style={props.styles.sheetHandle} /><View style={props.styles.sheetHeader}><View><Text style={props.styles.sheetKicker}>OMP ACCOUNT</Text><Text style={props.styles.sheetTitle}>Provider login</Text></View><Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close login"><Text style={props.styles.closeText}>×</Text></Pressable></View><Text style={props.styles.uiMessage}>Caret lists OMP providers from the Mac. It does not open a browser until you ask.</Text>{props.providers.length ? props.providers.map(provider => <View key={provider.id} style={props.styles.loginRow}><View style={props.styles.modelCopy}><Text style={props.styles.modelLabel}>{provider.name}</Text><Text style={props.styles.modelMeta}>{provider.authenticated ? "Signed in" : provider.available === false ? "Unavailable" : "Not signed in"}</Text></View><Pressable onPress={() => props.onStartLogin(provider.id)} disabled={provider.available === false} style={[props.styles.secondaryButton, provider.available === false && props.styles.buttonDisabled]} accessibilityRole="button" accessibilityLabel={`${provider.authenticated ? "Re-login" : "Log in"} ${provider.name}`}><Text style={props.styles.secondaryButtonText}>{provider.authenticated ? "Re-login" : "Log in"}</Text></Pressable></View>) : <View style={props.styles.emptySheet}><Text style={props.styles.emptyBody}>Refresh to list OMP login providers.</Text><Pressable onPress={props.onRefresh} style={props.styles.primaryButton}><Text style={props.styles.primaryButtonText}>Refresh providers</Text></Pressable></View>}{urls.length ? <View style={props.styles.loginLinks}>{urls.map(item => <Pressable key={item.id} onPress={() => props.onOpenUrl(item.url!)} style={props.styles.optionRow} accessibilityRole="button" accessibilityLabel="Open login URL"><Text style={props.styles.optionLabel}>{item.title ?? "Open login page"}</Text>{item.instructions ? <Text style={props.styles.optionDescription}>{item.instructions}</Text> : <Text style={props.styles.optionDescription} numberOfLines={2}>{item.url}</Text>}</Pressable>)}</View> : null}<Text style={props.styles.sheetFootnote}>OAuth stays on OMP. This phone only starts login and opens the URL you choose.</Text></View></View></Modal>;
}

function UiSheet(props: { request: PendingUiRequest; visible: boolean; styles: ReturnType<typeof makeStyles>; palette: Palette; onClose: () => void; onAnswer: (answer: UiResponseRequest["answer"]) => void }) {
  const { request } = props;
  const [value, setValue] = useState(request.request.method === "editor" ? request.request.prefill ?? "" : "");
  useEffect(() => setValue(request.request.method === "editor" ? request.request.prefill ?? "" : ""), [request]);
  const submit = (answer: UiResponseRequest["answer"]) => props.onAnswer(answer);
  const ui = request.request;
  let body: React.ReactNode;
  if (ui.method === "confirm") {
    body = <><Text style={props.styles.uiMessage}>{ui.message}</Text><View style={props.styles.uiActions}><Pressable onPress={() => submit(false)} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable onPress={() => submit(true)} style={props.styles.primaryButton}><Text style={props.styles.primaryButtonText}>Confirm</Text></Pressable></View></>;
  } else if (ui.method === "select") {
    body = <ScrollView>{ui.options.map((option, index) => <Pressable key={`${option}:${index}`} onPress={() => submit(option)} style={props.styles.optionRow} accessibilityRole="button"><Text style={props.styles.optionLabel}>{option}</Text>{ui.optionDetails?.[index]?.description ? <Text style={props.styles.optionDescription}>{ui.optionDetails[index]!.description}</Text> : null}</Pressable>)}<Pressable onPress={() => submit({ cancelled: true })} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Cancel</Text></Pressable></ScrollView>;
  } else {
    const editor = ui.method === "editor";
    body = <><TextInput value={value} onChangeText={setValue} multiline={editor} style={[props.styles.uiInput, editor && props.styles.editorInput]} placeholder={ui.method === "input" ? ui.placeholder : "Write a response"} placeholderTextColor={props.palette.muted} autoFocus accessibilityLabel={ui.title} /><View style={props.styles.uiActions}><Pressable onPress={() => submit({ cancelled: true })} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable onPress={() => submit(value)} style={props.styles.primaryButton}><Text style={props.styles.primaryButtonText}>Send</Text></Pressable></View></>;
  }
  return <Modal visible={props.visible} transparent animationType="fade" onRequestClose={() => submit({ cancelled: true })}><View style={props.styles.modalBackdrop}><View style={props.styles.uiSheet}><View style={props.styles.sheetHeader}><View><Text style={props.styles.sheetKicker}>OMP INTERACTION</Text><Text style={props.styles.sheetTitle}>{ui.title}</Text></View><Pressable onPress={() => submit({ cancelled: true })} accessibilityRole="button" accessibilityLabel="Cancel interaction"><Text style={props.styles.closeText}>×</Text></Pressable></View>{body}</View></View></Modal>;
}

function PairingSheet(props: { visible: boolean; styles: ReturnType<typeof makeStyles>; palette: Palette; onClose: () => void; onImport: (offer: PairingOffer) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const parse = useCallback((raw: string) => {
    try { const offer = parsePairingOffer(raw); setError(null); props.onImport(offer); setText(""); setScan(false); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [props]);
  const scanResult = useCallback((result: BarcodeScanningResult) => { if (result.data) parse(result.data); }, [parse]);
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={props.styles.modalBackdrop}><View style={props.styles.sheet}><View style={props.styles.sheetHandle} /><View style={props.styles.sheetHeader}><View><Text style={props.styles.sheetKicker}>PRIVATE CONNECTION</Text><Text style={props.styles.sheetTitle}>Pair your Mac</Text></View><Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close connection"><Text style={props.styles.closeText}>×</Text></Pressable></View><Text style={props.styles.uiMessage}>Scan the private QR from Caret on your Mac, or paste its offer here. Your credentials stay protected on this phone.</Text>{scan ? <View style={props.styles.cameraBox}>{permission?.granted ? <CameraView style={StyleSheet.absoluteFill} facing="back" onBarcodeScanned={scanResult} /> : <View style={props.styles.cameraPermission}><Text style={props.styles.emptyBody}>Camera permission is needed to scan a pairing QR.</Text><Pressable onPress={() => void requestPermission()} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Allow camera</Text></Pressable></View>}<View style={props.styles.scanFrame} pointerEvents="none"><View style={props.styles.scanCornerTopLeft} /><View style={props.styles.scanCornerTopRight} /><View style={props.styles.scanCornerBottomLeft} /><View style={props.styles.scanCornerBottomRight} /></View></View> : <><TextInput value={text} onChangeText={setText} multiline style={props.styles.pairingInput} placeholder="Paste private JSON or https://…/#offer=…" placeholderTextColor={props.palette.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Pairing offer" />{error ? <Text style={props.styles.errorText}>{error}</Text> : null}<View style={props.styles.uiActions}><Pressable onPress={() => setScan(true)} style={props.styles.secondaryButton}><Text style={props.styles.secondaryButtonText}>Scan QR</Text></Pressable><Pressable onPress={() => parse(text)} disabled={!text.trim()} style={[props.styles.primaryButton, !text.trim() && props.styles.buttonDisabled]}><Text style={props.styles.primaryButtonText}>Import offer</Text></Pressable></View></>}<Text style={props.styles.sheetFootnote}>This connection keeps your Caret workspace with the same Mac.</Text></View></View></Modal>;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    header: { height: 76, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    brandMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" },
    brandMarkText: { color: palette.white, fontSize: 24, lineHeight: 26, fontWeight: "700" },
    brand: { color: palette.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
    brandCaption: { color: palette.muted, fontSize: 11, marginTop: 1 },
    connectionPill: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", gap: 6 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    connectionText: { color: palette.muted, fontSize: 12, fontWeight: "700" },
    dashboard: { paddingHorizontal: 20, paddingBottom: 42, gap: 14 },
    hero: { paddingTop: 17, paddingBottom: 4 },
    eyebrow: { color: palette.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
    heroTitle: { color: palette.text, fontSize: 34, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
    heroBody: { color: palette.muted, fontSize: 15, lineHeight: 22, marginTop: 4, maxWidth: 330 },
    searchWrap: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
    searchIcon: { fontSize: 23, color: palette.muted, marginRight: 8, marginTop: -2 },
    searchInput: { flex: 1, color: palette.text, fontSize: 15, paddingVertical: 0 },
    segmented: { flexDirection: "row", backgroundColor: palette.elevated, padding: 3, borderRadius: 12 },
    segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9 },
    segmentActive: { backgroundColor: palette.surface },
    segmentText: { color: palette.muted, fontSize: 13, fontWeight: "700" },
    segmentTextActive: { color: palette.text },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    rowGap: { flexDirection: "row", alignItems: "center", gap: 12 },
    sectionTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
    linkText: { color: palette.accent, fontSize: 12, fontWeight: "700" },
    refresh: { color: palette.accent, fontSize: 22 },
    card: { minHeight: 76, borderRadius: 17, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
    cardSelected: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
    cardCompact: { minHeight: 68 },
    cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
    cardCopy: { flex: 1, gap: 4 },
    cardTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
    cardSubtitle: { color: palette.muted, fontSize: 12 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    projectGlyph: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" },
    projectGlyphText: { color: palette.accent, fontSize: 17, fontWeight: "800" },
    taskGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    taskGlyphText: { fontSize: 26, fontWeight: "700", marginTop: -3 },
    actionIcon: { color: palette.muted, fontSize: 22, minWidth: 20, textAlign: "center" },
    empty: { alignItems: "center", paddingVertical: 38, paddingHorizontal: 30, gap: 8 },
    emptyMark: { width: 50, height: 50, borderRadius: 18, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 3 },
    emptyMarkText: { color: palette.accent, fontSize: 30 },
    emptyTitle: { color: palette.text, fontSize: 17, fontWeight: "800" },
    emptyBody: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
    unavailable: { borderRadius: 17, backgroundColor: palette.elevated, padding: 16, gap: 6, marginTop: 4 },
    unavailableTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
    unavailableBody: { color: palette.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 },
    errorText: { color: palette.danger, fontSize: 12, lineHeight: 17 },
    primaryButton: { alignSelf: "flex-start", borderRadius: 12, backgroundColor: palette.accent, paddingHorizontal: 15, paddingVertical: 11, minHeight: 42, justifyContent: "center" },
    primaryButtonText: { color: palette.white, fontSize: 13, fontWeight: "800", textAlign: "center" },
    secondaryButton: { alignSelf: "flex-start", borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 15, paddingVertical: 10, minHeight: 42, justifyContent: "center" },
    secondaryButtonText: { color: palette.text, fontSize: 13, fontWeight: "700", textAlign: "center" },
    buttonDisabled: { opacity: 0.42 },
    pairedHint: { color: palette.muted, fontSize: 11, textAlign: "center", paddingHorizontal: 20, paddingBottom: 8 },
    detailRoot: { flex: 1 },
    detailHeader: { minHeight: 64, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: palette.border, gap: 8 },
    backButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.elevated },
    backText: { color: palette.text, fontSize: 29, lineHeight: 28, marginTop: -3 },
    detailTitleWrap: { flex: 1, gap: 2 },
    detailTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
    detailSubtitle: { color: palette.muted, fontSize: 11 },
    detailActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    artifactButton: { minHeight: 35, borderRadius: 11, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
    artifactButtonText: { color: palette.text, fontSize: 11, fontWeight: "700" },
    modelButton: { maxWidth: 116, minHeight: 35, borderRadius: 11, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 5 },
    modelButtonText: { color: palette.text, fontSize: 11, fontWeight: "700", flexShrink: 1 },
    modelChevron: { color: palette.muted, fontSize: 16 },
    transcript: { flex: 1 },
    transcriptContent: { padding: 16, gap: 10, paddingBottom: 24 },
    sessionStart: { borderRadius: 18, backgroundColor: palette.accentSoft, padding: 18, gap: 7, marginTop: 10, marginBottom: 4 },
    sessionStartTitle: { color: palette.text, fontSize: 17, fontWeight: "800" },
    sessionStartBody: { color: palette.muted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
    messageCard: { borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 14, gap: 6 },
    userMessage: { backgroundColor: palette.accentSoft, borderColor: "transparent" },
    messageRole: { color: palette.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
    messageText: { color: palette.text, fontSize: 15, lineHeight: 22 },
    streaming: { alignSelf: "flex-start", marginTop: 3 },
    toolCard: { borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, padding: 13, gap: 9 },
    toolHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    toolIcon: { width: 25, height: 25, borderRadius: 8, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" },
    toolIconText: { color: palette.accent, fontSize: 13 },
    toolName: { color: palette.text, fontSize: 13, fontWeight: "800", flex: 1 },
    toolStatus: { fontSize: 11, fontWeight: "800" },
    toolArgs: { color: palette.muted, fontSize: 11, lineHeight: 16, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
    toolOutput: { color: palette.text, fontSize: 13, lineHeight: 19 },
    eventRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 4 },
    eventDot: { color: palette.accent, fontSize: 24, lineHeight: 18 },
    eventText: { color: palette.muted, fontSize: 12, flex: 1 },
    warningBanner: { borderRadius: 15, borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.elevated, padding: 13, gap: 6 },
    warningTitle: { color: palette.warning, fontSize: 13, fontWeight: "800" },
    warningBody: { color: palette.muted, fontSize: 12, lineHeight: 18 },
    warningAction: { alignSelf: "flex-start", paddingVertical: 5 },
    warningActionText: { color: palette.accent, fontSize: 12, fontWeight: "800" },
    composerBar: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.bg, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
    composerRow: { borderRadius: 15, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: "row", alignItems: "flex-end", padding: 5 },
    composerInput: { flex: 1, color: palette.text, fontSize: 15, lineHeight: 21, paddingHorizontal: 9, paddingVertical: 8, maxHeight: 132 },
    sendButton: { width: 37, height: 37, borderRadius: 12, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" },
    sendText: { color: palette.white, fontSize: 23, fontWeight: "700", marginTop: -2 },
    composerActions: { flexDirection: "row", gap: 15, paddingHorizontal: 4, paddingTop: 7 },
    composerAction: { paddingVertical: 3 },
    composerActionText: { color: palette.muted, fontSize: 12, fontWeight: "700" },
    modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(8,10,18,0.48)" },
    sheet: { maxHeight: "88%", borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface, padding: 20, paddingBottom: 32, gap: 13 },
    uiSheet: { maxHeight: "86%", borderRadius: 22, backgroundColor: palette.surface, padding: 20, margin: 20, gap: 13 },
    sheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border, marginBottom: 3 },
    sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
    sheetKicker: { color: palette.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
    sheetTitle: { color: palette.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
    closeText: { color: palette.muted, fontSize: 29, lineHeight: 27, paddingHorizontal: 4 },
    modelRow: { minHeight: 56, borderRadius: 13, backgroundColor: palette.elevated, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    loginRow: { minHeight: 56, borderRadius: 13, backgroundColor: palette.elevated, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    loginLinks: { gap: 8, marginTop: 8 },
    modelCopy: { flex: 1, gap: 3 },
    modelLabel: { color: palette.text, fontSize: 14, fontWeight: "700" },
    modelMeta: { color: palette.muted, fontSize: 11 },
    modelCheck: { color: palette.accent, fontSize: 19, fontWeight: "800" },
    emptySheet: { alignItems: "center", gap: 12, paddingVertical: 20 },
    sheetFootnote: { color: palette.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
    uiMessage: { color: palette.text, fontSize: 15, lineHeight: 22 },
    uiActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 3 },
    uiInput: { minHeight: 49, maxHeight: 160, borderRadius: 13, borderWidth: 1, borderColor: palette.border, color: palette.text, backgroundColor: palette.elevated, fontSize: 15, paddingHorizontal: 13, paddingVertical: 11 },
    editorInput: { minHeight: 130, textAlignVertical: "top" },
    optionRow: { borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 13, gap: 3 },
    optionLabel: { color: palette.text, fontSize: 14, fontWeight: "700" },
    optionDescription: { color: palette.muted, fontSize: 12, lineHeight: 17 },
    pairingInput: { minHeight: 130, maxHeight: 220, borderRadius: 14, borderWidth: 1, borderColor: palette.border, color: palette.text, backgroundColor: palette.elevated, fontSize: 13, lineHeight: 19, paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: "top" },
    artifactSheet: { maxHeight: "88%", borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface, padding: 20, paddingBottom: 28, gap: 12 },
    artifactViewer: { maxHeight: "92%", borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.surface, padding: 20, paddingBottom: 28, gap: 12 },
    artifactSession: { color: palette.muted, fontSize: 11, marginTop: 4, maxWidth: 250 },
    artifactList: { minHeight: 80, maxHeight: 410 },
    artifactListContent: { gap: 8, paddingVertical: 2 },
    artifactRow: { minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
    artifactGlyph: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" },
    artifactGlyphText: { color: palette.accent, fontSize: 15, fontWeight: "800" },
    artifactCopy: { flex: 1, gap: 3 },
    artifactTitle: { color: palette.text, fontSize: 13, fontWeight: "800" },
    artifactMeta: { color: palette.muted, fontSize: 11 },
    artifactSource: { color: palette.muted, fontSize: 10 },
    artifactChevron: { color: palette.muted, fontSize: 25, lineHeight: 25 },
    artifactEmpty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 25, paddingVertical: 25, gap: 6 },
    artifactLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 48 },
    artifactActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 3 },
    artifactInput: { minHeight: 49, borderRadius: 13, borderWidth: 1, borderColor: palette.border, color: palette.text, backgroundColor: palette.elevated, fontSize: 14, paddingHorizontal: 13, paddingVertical: 11 },
    artifactSourcesInput: { minHeight: 82, textAlignVertical: "top" },
    artifactPreview: { maxHeight: 460, borderRadius: 14, backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border },
    artifactPreviewContent: { padding: 13 },
    artifactText: { color: palette.text, fontSize: 12, lineHeight: 18, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
    artifactImage: { width: "100%", height: 360, backgroundColor: palette.elevated, borderRadius: 14 },
    artifactMedia: { width: "100%", height: 185, borderRadius: 14, backgroundColor: "#10131B" },
    cameraBox: { height: 300, borderRadius: 18, overflow: "hidden", backgroundColor: palette.elevated, position: "relative" },
    cameraPermission: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
    scanFrame: { position: "absolute", width: 220, height: 220, left: "50%", top: "50%", marginLeft: -110, marginTop: -110 },
    scanCornerTopLeft: { position: "absolute", left: 0, top: 0, width: 30, height: 30, borderLeftWidth: 3, borderTopWidth: 3, borderColor: palette.accent, borderTopLeftRadius: 9 },
    scanCornerTopRight: { position: "absolute", right: 0, top: 0, width: 30, height: 30, borderRightWidth: 3, borderTopWidth: 3, borderColor: palette.accent, borderTopRightRadius: 9 },
    scanCornerBottomLeft: { position: "absolute", left: 0, bottom: 0, width: 30, height: 30, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: palette.accent, borderBottomLeftRadius: 9 },
    scanCornerBottomRight: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRightWidth: 3, borderBottomWidth: 3, borderColor: palette.accent, borderBottomRightRadius: 9 },
  });
}
