import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { VirtualTerminalRendererCoordinator, type VirtualTerminalIdentity, type VirtualTerminalSnapshot } from "../core/virtual-terminal.ts";
import { terminalMessage, terminalDocument } from "./terminal/document.ts";

export interface VirtualTerminalPalette {
  readonly surface: string;
  readonly elevated: string;
  readonly border: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly success: string;
  readonly white: string;
}

export interface VirtualTerminalProps {
  readonly sessionId: string;
  readonly incarnation: string;
  readonly terminal: VirtualTerminalSnapshot;
  readonly palette: VirtualTerminalPalette;
  readonly onInput: (identity: VirtualTerminalIdentity, data: string) => void;
  readonly onResize: (identity: VirtualTerminalIdentity, cols: number, rows: number) => void;
  readonly onNegotiate: (identity: VirtualTerminalIdentity, cols: number, rows: number) => void;
}

const FRAME_HEIGHT = 268;

function dimensions(width: number, height: number): { cols: number; rows: number } {
  // Keep the same conservative cell estimate on iOS, Android, and web. OMP
  // clamps again, while this avoids sending dimensions outside its contract.
  return {
    cols: Math.max(2, Math.min(500, Math.floor(Math.max(0, width - 20) / 8.4))),
    rows: Math.max(1, Math.min(200, Math.floor(Math.max(0, height - 20) / 17))),
  };
}

export function VirtualTerminalPanel(props: {
  readonly sessionId: string;
  readonly incarnation: string;
  readonly terminals: readonly VirtualTerminalSnapshot[];
  readonly palette: VirtualTerminalPalette;
  readonly onInput: (identity: VirtualTerminalIdentity, data: string) => void;
  readonly onResize: (identity: VirtualTerminalIdentity, cols: number, rows: number) => void;
  readonly onNegotiate: (identity: VirtualTerminalIdentity, cols: number, rows: number) => void;
}) {
  if (props.terminals.length === 0) return null;
  return <View style={[styles.panel, { backgroundColor: props.palette.surface, borderColor: props.palette.border }]}>
    <View style={styles.panelHeader}><Text style={[styles.panelTitle, { color: props.palette.text }]}>Live terminal</Text><Text style={[styles.panelHint, { color: props.palette.muted }]}>Interactive session</Text></View>
    {props.terminals.map(terminal => <VirtualTerminalView key={`${props.sessionId}:${props.incarnation}:${terminal.terminalId}`} sessionId={props.sessionId} incarnation={props.incarnation} terminal={terminal} palette={props.palette} onInput={props.onInput} onResize={props.onResize} onNegotiate={props.onNegotiate} />)}
  </View>;
}

export function VirtualTerminalView(props: VirtualTerminalProps) {
  const { terminal, palette } = props;
  const identity = useMemo<VirtualTerminalIdentity>(() => ({ sessionId: props.sessionId, incarnation: props.incarnation, terminalId: terminal.terminalId }), [props.sessionId, props.incarnation, terminal.terminalId]);
  const webViewRef = useRef<WebView | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const layoutRef = useRef({ width: 0, height: FRAME_HEIGHT });
  const coordinatorRef = useRef<VirtualTerminalRendererCoordinator | null>(null);
  const coordinatorIdentityRef = useRef<string | null>(null);
  const identityToken = `${identity.sessionId}\u0000${identity.incarnation}\u0000${identity.terminalId}`;
  if (!coordinatorRef.current || coordinatorIdentityRef.current !== identityToken) {
    coordinatorRef.current = new VirtualTerminalRendererCoordinator(identity);
    coordinatorIdentityRef.current = identityToken;
  }
  const [ready, setReady] = useState(false);
  const [rendererReadyGeneration, setRendererReadyGeneration] = useState(0);
  // This generation controls only the WebView/iframe mount. Ready events
  // increment rendererReadyGeneration and replay in place; they must not
  // trigger a key remount loop.
  const [rendererMountGeneration, setRendererMountGeneration] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const recoverySequenceRef = useRef(-1);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const html = useMemo(() => terminalDocument({ terminalId: identity.terminalId, cols: terminal.cols, rows: terminal.rows, title: terminal.title }), [identity.terminalId, terminal.cols, terminal.rows, terminal.title]);
  const rendererKey = `${identity.sessionId}:${identity.incarnation}:${identity.terminalId}:${rendererMountGeneration}`;

  const post = useCallback((message: Record<string, unknown>) => {
    const serialized = JSON.stringify({ source: "caret-terminal", payload: message });
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage(serialized, "*");
    } else {
      webViewRef.current?.postMessage(serialized);
    }
  }, []);

  const requestResize = useCallback(() => {
    if (!ready) return;
    const next = dimensions(layoutRef.current.width, layoutRef.current.height);
    if (next.cols === terminal.cols && next.rows === terminal.rows) return;
    props.onResize(identity, next.cols, next.rows);
    post({ type: "resize", cols: next.cols, rows: next.rows });
  }, [identity, post, props.onResize, ready, terminal.cols, terminal.rows]);

  const sendRendererPlan = useCallback((plan: ReturnType<VirtualTerminalRendererCoordinator["ready"]>, snapshot: VirtualTerminalSnapshot) => {
    if (!plan) return;
    for (const message of plan.messages) post(message);
    if (!plan.requestRecovery) {
      // A no-op update immediately after ready must not clear the recovery
      // state before OMP's redraw output arrives. Clear it only after actual
      // post-recovery output (or a full non-truncated replay) was delivered.
      if (plan.messages.some(message => message.type === "output") && snapshot.lastOutputSequence > recoverySequenceRef.current) setRecovering(false);
      return;
    }
    const next = layoutRef.current.width > 0 ? dimensions(layoutRef.current.width, layoutRef.current.height) : { cols: snapshot.cols, rows: snapshot.rows };
    recoverySequenceRef.current = snapshot.lastOutputSequence;
    setRecovering(true);
    props.onNegotiate(identity, next.cols, next.rows);
  }, [identity, post, props.onNegotiate]);

  const handleMessage = useCallback((value: unknown) => {
    const message = terminalMessage(value);
    if (!message || message.terminalId !== identity.terminalId) return;
    if (message.type === "ready") {
      const plan = coordinatorRef.current?.ready(identity, terminal);
      if (!plan) return;
      setRendererError(null);
      setReady(true);
      setRendererReadyGeneration(plan.readyGeneration);
      sendRendererPlan(plan, terminal);
      if (!plan.requestRecovery) {
        setRecovering(false);
        recoverySequenceRef.current = -1;
      }
      const next = dimensions(layoutRef.current.width, layoutRef.current.height);
      if (layoutRef.current.width > 0 && (next.cols !== terminal.cols || next.rows !== terminal.rows)) {
        props.onResize(identity, next.cols, next.rows);
        post({ type: "resize", cols: next.cols, rows: next.rows });
      }
      return;
    }
    if (message.type === "error") {
      setRendererError(typeof message.message === "string" ? message.message : "Terminal renderer failed");
      return;
    }
    if (message.type === "input" && typeof message.data === "string" && message.data.length > 0) {
      // Input is sent only for the currently mounted incarnation. The parent
      // dispatches a fresh durable command and never replays it automatically.
      props.onInput(identity, message.data);
    }
  }, [identity, post, props.onInput, props.onResize, sendRendererPlan, terminal]);

  const onNativeMessage = useCallback((event: WebViewMessageEvent) => handleMessage(event.nativeEvent.data), [handleMessage]);
  const onWebMessage = useCallback((event: MessageEvent<string>) => {
    if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
    handleMessage(event.data);
  }, [handleMessage]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    window.addEventListener("message", onWebMessage);
    return () => window.removeEventListener("message", onWebMessage);
  }, [onWebMessage]);

  useEffect(() => {
    if (!ready) return;
    const plan = coordinatorRef.current?.update(identity, terminal);
    if (!plan) return;
    sendRendererPlan(plan, terminal);
    if (recovering && terminal.lastOutputSequence > recoverySequenceRef.current) setRecovering(false);
  }, [identity, ready, recovering, rendererReadyGeneration, sendRendererPlan, terminal]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    layoutRef.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
    requestResize();
  }, [requestResize]);

  const frameStyle = [styles.frame, { borderColor: palette.border, backgroundColor: "#10131B" }];
  const status = terminal.closed ? `Closed${terminal.closeReason ? ` · ${terminal.closeReason}` : ""}${terminal.historyTruncated ? " · history trimmed" : ""}` : recovering ? "Restoring screen…" : terminal.historyTruncated ? (ready ? "Live · history trimmed" : "Loading renderer…") : ready ? "Connected" : "Loading renderer…";
  return <View style={styles.terminal} onLayout={onLayout} accessibilityLabel={`${terminal.title ?? "Terminal"} ${status}`}>
    <View style={styles.terminalHeader}><Text style={[styles.terminalTitle, { color: palette.text }]} numberOfLines={1}>{terminal.title ?? "Terminal"}</Text><View style={styles.terminalStatus}><View style={[styles.statusDot, { backgroundColor: terminal.closed ? palette.muted : ready ? palette.success : palette.accent }]} /><Text style={[styles.statusText, { color: palette.muted }]}>{status}</Text></View></View>
    {Platform.OS === "web" ? React.createElement("iframe", {
      key: rendererKey,
      ref: iframeRef,
      title: terminal.title ?? "Caret terminal",
      srcDoc: html,
      sandbox: "allow-scripts",
      tabIndex: 0,
      style: { ...styles.frame, borderColor: palette.border, backgroundColor: "#10131B" },
      onLoad: () => post({ type: "focus" }),
    }) : <WebView
      key={rendererKey}
      ref={webViewRef}
      source={{ html }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      bounces={false}
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      onMessage={onNativeMessage}
      onTouchStart={() => post({ type: "focus" })}
      style={frameStyle}
    />}
    {rendererError ? <Pressable onPress={() => { setRendererError(null); setReady(false); setRecovering(false); recoverySequenceRef.current = -1; coordinatorRef.current?.resetRenderer(); setRendererMountGeneration(generation => generation + 1); }}><Text style={[styles.error, { color: palette.accent }]}>Terminal renderer error: {rendererError}. Tap to retry.</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { borderRadius: 16, borderWidth: 1, padding: 10, gap: 8 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3 },
  panelTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  panelHint: { fontSize: 10, fontWeight: "700" },
  terminal: { minHeight: 318, gap: 6 },
  terminalHeader: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 3 },
  terminalTitle: { flex: 1, fontSize: 12, fontWeight: "800" },
  terminalStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },
  frame: { height: FRAME_HEIGHT, width: "100%", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  error: { fontSize: 11, lineHeight: 16, paddingHorizontal: 3 },
});
