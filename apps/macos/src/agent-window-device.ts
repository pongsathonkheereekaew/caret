/**
 * Native iOS Simulator service for the Cedia Agent Window.
 *
 * Synara owns the simulator state machine (`DeviceManager`) and the private
 * CoreSimulator helper. Cedia only supplies the authenticated Electron IPC
 * boundary and the lifetime of each renderer subscription. Keeping that seam
 * here means the exact Synara backend can be exercised against its fake in
 * tests without launching Xcode.
 */
import { access } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import type {
  DeviceHardwareButton,
  DeviceKeyModifier,
} from '../agent-window/vendor/synara/packages/contracts/src/index.ts';
import { DeviceManager } from '../agent-window/vendor/synara/apps/server/src/device/DeviceManager.ts';
import type {
  DeviceBackend,
  DeviceKeyEvent,
  DeviceSwipeGesture,
} from '../agent-window/vendor/synara/apps/server/src/device/DeviceBackend.ts';
import { IosSimulatorBackend } from '../agent-window/vendor/synara/apps/server/src/device/IosSimulatorBackend.ts';
import {
  NULL_BOOT_OWNERSHIP,
  makeBootOwnershipStore,
} from '../agent-window/vendor/synara/apps/server/src/device/bootOwnership.ts';
import type { DeviceFrameSink } from '../agent-window/vendor/synara/apps/server/src/device/deviceFrameTransport.ts';
import type { DeviceUiTarget } from '../agent-window/vendor/synara/apps/server/src/device/uiTreeTargeting.ts';
import { decodeDeviceFrame } from '../agent-window/vendor/synara/packages/shared/src/deviceFrame.ts';

export const CEDIA_AGENT_DEVICE_EVENT_CHANNEL = 'vscode:cediaAgentDevice';
export const CEDIA_AGENT_DEVICE_FRAME_CHANNEL = 'vscode:cediaAgentDeviceFrames';

const MAX_UDID_LENGTH = 128;
const MAX_THREAD_ID_LENGTH = 256;
const MAX_TEXT_LENGTH = 4_096;
const MAX_URL_LENGTH = 8_192;
const MAX_PATH_LENGTH = 1_024;
const MAX_LABEL_LENGTH = 1_024;
const MAX_ROLE_LENGTH = 128;
const MAX_LAUNCH_ARGUMENTS = 64;
const MAX_LAUNCH_ARGUMENT_LENGTH = 1_024;
const MAX_COORDINATE = 20_000;

/** The narrow Electron sender shape used by the service and its tests. */
export interface AgentDeviceSender {
  readonly send: (channel: string, ...args: unknown[]) => void;
  /** Electron WebContents exposes a stable id even when IPC wraps the sender. */
  readonly id?: number;
  readonly isDestroyed?: () => boolean;
  readonly once?: (event: string, listener: () => void) => void;
}

export interface AgentDeviceEvent {
  readonly sender?: AgentDeviceSender;
}

export interface AgentDeviceServiceOptions {
  /** Packaged app root, used to locate the vendored native helper sources. */
  readonly appRoot?: string;
  /** Durable state root for boot ownership. Defaults to the Cedia host root. */
  readonly stateDir?: string;
  /** Test/platform seam; defaults to the process platform. */
  readonly platform?: NodeJS.Platform;
  /** Explicit helper source directory for packaged builds or tests. */
  readonly helperSourceDir?: string;
  /** Test seam. Production creates the exact Synara iOS backend. */
  readonly backend?: DeviceBackend;
  /** Test seam. When supplied, this manager is used as-is. */
  readonly manager?: DeviceManager;
}

export interface AgentDeviceService {
  handle(event: unknown, method: string, input: unknown): Promise<unknown>;
  dispose(): Promise<void>;
}

interface SenderState {
  readonly sender: AgentDeviceSender;
  eventsSubscribed: boolean;
  readonly frameSubscriptions: Map<string, FrameSubscription>;
  readonly attachedThreads: Map<string, string>;
}

interface QueuedFrame {
  readonly sequence: number;
  readonly bytes: Uint8Array;
}

interface FrameSubscription {
  unsubscribe: () => void;
  readonly queue: QueuedFrame[];
  inFlight: QueuedFrame | null;
}

type SenderKey = string | AgentDeviceSender;

const FRAME_QUEUE_LIMIT = 2;

interface RecordValue {
  readonly [key: string]: unknown;
}

function record(value: unknown): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Device request input must be an object');
  }
  return value as RecordValue;
}

function optionalRecord(value: unknown): RecordValue {
  if (value === undefined || value === null) return {};
  return record(value);
}

function stringField(input: RecordValue, field: string, maxLength: number): string {
  const value = input[field];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Invalid device ${field}`);
  }
  return value.trim();
}

/** Text input follows Synara's `Schema.String`: whitespace and empty strings
 * are meaningful keystrokes, so validation must not normalize the value. */
function textField(input: RecordValue, field: string, maxLength: number): string {
  const value = input[field];
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`Invalid device ${field}`);
  }
  return value;
}

function udid(input: RecordValue): string {
  const value = stringField(input, 'udid', MAX_UDID_LENGTH);
  if (!/^[A-Za-z0-9._:-]+$/u.test(value)) throw new Error('Invalid device udid');
  return value;
}

function threadId(input: RecordValue): string {
  return stringField(input, 'threadId', MAX_THREAD_ID_LENGTH);
}

function boolField(input: RecordValue, field: string): boolean | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`Invalid device ${field}`);
  return value;
}

function finiteNumber(input: RecordValue, field: string, minimum = 0, maximum = MAX_COORDINATE): number {
  const value = input[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid device ${field} coordinate`);
  }
  return value;
}

function integer(input: RecordValue, field: string, minimum: number, maximum: number): number {
  const value = input[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid device ${field}`);
  }
  return value;
}

function enumField<T extends string>(input: RecordValue, field: string, values: readonly T[]): T {
  const value = input[field];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`Invalid device ${field}`);
  }
  return value as T;
}

function optionalString(input: RecordValue, field: string, maxLength: number): string | undefined {
  const value = input[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Invalid device ${field}`);
  }
  return value.trim();
}

function helperSourceCandidates(appRoot: string | undefined): string[] {
  const candidates = [
    appRoot ? path.join(appRoot, 'native', 'device-helper') : null,
    appRoot ? path.join(appRoot, 'apps', 'server', 'native', 'device-helper') : null,
    appRoot ? path.join(appRoot, 'agent-window', 'vendor', 'synara', 'apps', 'server', 'native', 'device-helper') : null,
    path.resolve(import.meta.dir, '../agent-window/vendor/synara/apps/server/native/device-helper'),
  ];
  return candidates.filter((candidate): candidate is string => candidate !== null);
}

/**
 * Returns the first helper source directory that contains Synara's build
 * script. The fallback is retained even when the files are not present so the
 * backend can return its normal setup-required state instead of crashing.
 */
export async function resolveAgentDeviceHelperSourceDir(
  appRoot?: string,
  configured?: string,
): Promise<string | undefined> {
  const candidates = configured ? [configured, ...helperSourceCandidates(appRoot)] : helperSourceCandidates(appRoot);
  for (const candidate of candidates) {
    if (await access(path.join(candidate, 'build.sh')).then(() => true, () => false)) return candidate;
  }
  return candidates[0];
}

function defaultStateDir(): string {
  if (process.env.CEDIA_STATE_DIR) return path.resolve(process.env.CEDIA_STATE_DIR);
  return path.join(homedir(), 'Library', 'Application Support', 'Cedia', 'host');
}

function senderFromEvent(event: unknown): AgentDeviceSender {
  const value = event as AgentDeviceEvent | null;
  const sender = value?.sender;
  if (!sender || typeof sender.send !== 'function') throw new Error('Device IPC sender is unavailable');
  if (sender.isDestroyed?.()) throw new Error('Device IPC sender is destroyed');
  return sender;
}

function inputBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

/**
 * Build the native simulator service. Root IPC registration is intentionally
 * outside this module: the caller authenticates the panel request, then calls
 * `handle(event, method, input)` with Electron's invoke event.
 */
export function createAgentDeviceService(options: AgentDeviceServiceOptions = {}): AgentDeviceService {
  const platform = options.platform ?? process.platform;
  let manager: DeviceManager;
  let ownsManager = false;

  if (options.manager) {
    manager = options.manager;
  } else {
    const backend = options.backend ?? new IosSimulatorBackend({
      platform,
      // IosSimulatorBackend validates the source on its first helper build and
      // reports a setup state when Xcode or the helper is unavailable.
      helperSourceDir: options.helperSourceDir ?? helperSourceCandidates(options.appRoot)[0],
    });
    const stateDir = path.resolve(options.stateDir ?? defaultStateDir());
    manager = new DeviceManager({
      backend,
      bootOwnership: platform === 'darwin'
        ? makeBootOwnershipStore(path.join(stateDir, 'device-boot-ownership.json'))
        : NULL_BOOT_OWNERSHIP,
    });
    ownsManager = true;
    // Startup recovery is deliberately best-effort. A broken Xcode install
    // must still leave the pane able to render its availability checklist.
    void manager.reclaimOrphanedBoots().catch(() => undefined);
  }

  const senderStates = new Map<SenderKey, SenderState>();
  let disposed = false;

  const send = (state: SenderState, channel: string, payload: unknown): void => {
    if (disposed || state.sender.isDestroyed?.()) {
      void cleanupSender(state);
      return;
    }
    try {
      state.sender.send(channel, payload);
    } catch {
      void cleanupSender(state);
    }
  };

  const flushFrame = (state: SenderState, device: string, subscription: FrameSubscription): void => {
    if (subscription.inFlight !== null || subscription.queue.length === 0) return;
    const next = subscription.queue.shift()!;
    subscription.inFlight = next;
    send(state, CEDIA_AGENT_DEVICE_FRAME_CHANNEL, {
      udid: device,
      sequence: next.sequence,
      dataBase64: inputBytes(next.bytes),
    });
  };

  const enqueueFrame = (state: SenderState, device: string, subscription: FrameSubscription, bytes: Uint8Array): void => {
    const decoded = decodeDeviceFrame(bytes);
    if (!decoded.ok) return;
    const frame: QueuedFrame = { sequence: decoded.frame.header.sequence, bytes };
    if (subscription.inFlight !== null && subscription.queue.length >= FRAME_QUEUE_LIMIT) {
      // Keep the transport bounded and keyframe-aligned. The renderer will
      // observe the sequence gap and ask for a fresh codec config/IDR.
      subscription.queue.length = 0;
      if (!decoded.frame.header.keyframe && !decoded.frame.header.codecConfig) return;
    }
    subscription.queue.push(frame);
    flushFrame(state, device, subscription);
  };

  const onManagerEvent = (event: unknown): void => {
    for (const state of senderStates.values()) {
      if (state.eventsSubscribed) send(state, CEDIA_AGENT_DEVICE_EVENT_CHANNEL, event);
    }
  };

  const forgetThreadOwnership = (id: string): void => {
    for (const state of senderStates.values()) state.attachedThreads.delete(id);
  };

  const hasAttachedDevice = (device: string): boolean => {
    for (const state of senderStates.values()) {
      if ([...state.attachedThreads.values()].includes(device)) return true;
    }
    return false;
  };
  const removeManagerListener = manager.onEvent(onManagerEvent);

  const ensureSender = (event: unknown): SenderState => {
    const sender = senderFromEvent(event);
    const key: SenderKey = typeof sender.id === 'number' ? `webcontents:${sender.id}` : sender;
    const current = senderStates.get(key);
    if (current) return current;
    const state: SenderState = {
      sender,
      eventsSubscribed: false,
      frameSubscriptions: new Map(),
      attachedThreads: new Map(),
    };
    senderStates.set(key, state);
    sender.once?.('destroyed', () => { void cleanupSender(state); });
    return state;
  };

  async function cleanupSender(state: SenderState): Promise<void> {
    const key: SenderKey = typeof state.sender.id === 'number'
      ? `webcontents:${state.sender.id}`
      : state.sender;
    if (senderStates.get(key) !== state) return;
    senderStates.delete(key);
    for (const subscription of state.frameSubscriptions.values()) subscription.unsubscribe();
    state.frameSubscriptions.clear();
    const threads = [...state.attachedThreads.keys()];
    state.attachedThreads.clear();
    for (const id of threads) await manager.detach(id).catch(() => undefined);
    state.eventsSubscribed = false;
  }

  function requireNoExtra(value: RecordValue, fields: readonly string[]): void {
    // Unknown fields are ignored by Synara's Effect schemas; keep the same
    // compatibility here while validating every field that affects resources.
    void value;
    void fields;
  }

  async function handle(state: SenderState, method: string, rawInput: unknown): Promise<unknown> {
    if (disposed) throw new Error('Device service is disposed');
    const input = optionalRecord(rawInput);
    switch (method) {
      case 'list': {
        const includeShutdown = boolField(input, 'includeShutdown');
        return await manager.list(includeShutdown === undefined ? {} : { includeShutdown });
      }
      case 'subscribeEvents':
        state.eventsSubscribed = true;
        return { subscribed: true };
      case 'unsubscribeEvents':
        state.eventsSubscribed = false;
        return { subscribed: false };
      case 'getThreadState':
        return await manager.getThreadState(threadId(input));
      case 'boot':
        return await manager.boot(udid(input));
      case 'shutdown':
        await manager.shutdown(udid(input));
        return undefined;
      case 'attach': {
        const id = threadId(input);
        const device = udid(input);
        const previous = state.attachedThreads.get(id);
        // Electron may hand us a fresh sender wrapper for a later invoke from
        // the same WebContents. Keep the thread ownership authoritative across
        // those wrappers so the subsequent frame subscription is still tied to
        // the attach that just succeeded.
        forgetThreadOwnership(id);
        const result = await manager.attach(id, device);
        state.attachedThreads.set(id, device);
        if (previous && previous !== device) {
          // The manager already released the previous attachment; the set is
          // only used to authorize frame subscriptions for this sender.
          state.attachedThreads.set(id, device);
        }
        return result;
      }
      case 'detach': {
        const id = threadId(input);
        forgetThreadOwnership(id);
        state.attachedThreads.delete(id);
        return await manager.detach(id);
      }
      case 'subscribeFrames': {
        const device = udid(input);
        if (!hasAttachedDevice(device)) {
          throw new Error(`Device ${device} is not attached to this sender`);
        }
        if (state.frameSubscriptions.has(device)) return { subscribed: true, udid: device };
        const subscription: FrameSubscription = {
          unsubscribe: () => undefined,
          queue: [],
          inFlight: null,
        };
        const sink: DeviceFrameSink = {
          send: (bytes) => enqueueFrame(state, device, subscription, bytes),
          bufferedAmount: () => 0,
          isOpen: () => !disposed && !state.sender.isDestroyed?.(),
        };
        const unsubscribe = manager.subscribeFrames(device, sink);
        subscription.unsubscribe = unsubscribe;
        state.frameSubscriptions.set(device, subscription);
        return { subscribed: true, udid: device };
      }
      case 'unsubscribeFrames': {
        const device = udid(input);
        const subscription = state.frameSubscriptions.get(device);
        if (subscription) {
          subscription.unsubscribe();
          subscription.queue.length = 0;
          subscription.inFlight = null;
          state.frameSubscriptions.delete(device);
        }
        return { subscribed: false, udid: device };
      }
      case 'ackFrame': {
        const device = udid(input);
        const subscription = state.frameSubscriptions.get(device);
        if (!subscription) return undefined;
        const sequence = integer(input, 'sequence', 0, 0xFFFF_FFFF);
        if (subscription.inFlight?.sequence === sequence) {
          subscription.inFlight = null;
          flushFrame(state, device, subscription);
        }
        return undefined;
      }
      case 'requestResync': {
        const device = udid(input);
        if (!state.frameSubscriptions.has(device)) throw new Error(`Device ${device} has no frame subscription`);
        await manager.requestKeyframe(device);
        return undefined;
      }
      case 'tap': {
        const device = udid(input);
        const hasX = input.x !== undefined;
        const hasY = input.y !== undefined;
        if (hasX !== hasY) throw new Error('Device tap requires both coordinates');
        if (hasX) return await manager.tap(device, finiteNumber(input, 'x'), finiteNumber(input, 'y'));
        const label = optionalString(input, 'label', MAX_LABEL_LENGTH);
        if (!label) throw new Error('Device tap requires coordinates or a label');
        const role = optionalString(input, 'role', MAX_ROLE_LENGTH);
        return await manager.tapElement(device, { label, ...(role ? { role } : {}) } satisfies DeviceUiTarget);
      }
      case 'scrollToElement': {
        const device = udid(input);
        const label = stringField(input, 'label', MAX_LABEL_LENGTH);
        const role = optionalString(input, 'role', MAX_ROLE_LENGTH);
        const maxSwipes = input.maxSwipes === undefined ? undefined : integer(input, 'maxSwipes', 1, 32);
        const match = await manager.scrollToElement(device, { label, ...(role ? { role } : {}) }, maxSwipes === undefined ? {} : { maxScrolls: maxSwipes });
        return { udid: device, element: match.node, tapPoint: match.point };
      }
      case 'swipe': {
        const gesture: DeviceSwipeGesture = {
          fromX: finiteNumber(input, 'fromX'),
          fromY: finiteNumber(input, 'fromY'),
          toX: finiteNumber(input, 'toX'),
          toY: finiteNumber(input, 'toY'),
          durationMs: integer(input, 'durationMs', 0, 10_000),
        };
        return await manager.swipe(udid(input), gesture);
      }
      case 'typeText':
        return await manager.typeText(udid(input), textField(input, 'text', MAX_TEXT_LENGTH));
      case 'keyEvent': {
        const modifiers = input.modifiers;
        if (!Array.isArray(modifiers) || modifiers.length > 5 || modifiers.some((item) => typeof item !== 'string')) {
          throw new Error('Invalid device modifiers');
        }
        const event: DeviceKeyEvent = {
          keyCode: integer(input, 'keyCode', 0, 65_535),
          modifiers: modifiers.map((item) => enumField({ value: item }, 'value', ['command', 'shift', 'option', 'control', 'function'] as const)) as DeviceKeyModifier[],
          direction: enumField(input, 'direction', ['down', 'up'] as const),
        };
        return await manager.keyEvent(udid(input), event);
      }
      case 'pressButton':
        return await manager.pressButton(udid(input), enumField(input, 'button', ['home', 'lock', 'volume-up', 'volume-down', 'rotate'] as const) as DeviceHardwareButton);
      case 'installApp': {
        const appPath = stringField(input, 'appPath', MAX_PATH_LENGTH);
        if (!path.isAbsolute(appPath)) throw new Error('Device appPath must be absolute');
        return await manager.install(udid(input), appPath);
      }
      case 'launchApp': {
        const args = input.arguments;
        if (args !== undefined && (!Array.isArray(args) || args.length > MAX_LAUNCH_ARGUMENTS || args.some((item) => typeof item !== 'string' || item.length > MAX_LAUNCH_ARGUMENT_LENGTH))) {
          throw new Error('Invalid device launch arguments');
        }
        return await manager.launch(udid(input), stringField(input, 'bundleId', 256), args as string[] | undefined);
      }
      case 'openUrl':
        return await manager.openUrl(udid(input), stringField(input, 'url', MAX_URL_LENGTH));
      case 'screenshot':
        return await manager.screenshot(udid(input), boolField(input, 'save') === undefined ? {} : { save: boolField(input, 'save') });
      case 'startRecording':
        return await manager.startRecording(udid(input));
      case 'stopRecording':
        return await manager.stopRecording(udid(input));
      case 'describeUi':
        return await manager.describeUi(udid(input));
      default:
        requireNoExtra(input, []);
        throw new Error(`Unsupported device method: ${method}`);
    }
  }

  return {
    handle: async (event, method, input) => await handle(ensureSender(event), method, input),
    async dispose() {
      if (disposed) return;
      disposed = true;
      removeManagerListener();
      await Promise.all([...senderStates.values()].map((state) => cleanupSender(state)));
      if (ownsManager) await manager.dispose();
    },
  };
}
