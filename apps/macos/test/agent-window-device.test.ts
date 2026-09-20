import { expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { decodeDeviceFrame } from '../agent-window/vendor/synara/packages/shared/src/deviceFrame.ts';
import { encodeDeviceFrame } from '../agent-window/vendor/synara/packages/shared/src/deviceFrame.ts';
import { FakeDeviceBackend } from '../agent-window/vendor/synara/apps/server/src/device/FakeDeviceBackend.ts';
import { createNativeDeviceApi, installNativeDeviceFrameSource } from '../agent-window/src/native-device.ts';
import { createAgentDeviceService } from '../src/agent-window-device.ts';

interface Sender {
  id?: number;
  sent: Array<{ channel: string; payload: unknown }>;
  send: (channel: string, payload: unknown) => void;
  isDestroyed: () => boolean;
  once: (event: string, listener: () => void) => void;
  destroy: () => void;
}

function makeSender(id?: number): Sender {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const destroyedListeners = new Set<() => void>();
  let destroyed = false;
  return {
    ...(id === undefined ? {} : { id }),
    sent,
    send: (channel, payload) => { sent.push({ channel, payload }); },
    isDestroyed: () => destroyed,
    once: (event, listener) => { if (event === 'destroyed') destroyedListeners.add(listener); },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const listener of destroyedListeners) listener();
      destroyedListeners.clear();
    },
  };
}

it('keeps frame authorization when Electron wraps one WebContents across invokes', async () => {
  await withService(async ({ service, backend, sender }) => {
    await service.handle({ sender }, 'boot', { udid: 'FAKE-0001' });
    await service.handle({ sender }, 'attach', { threadId: 'thread-wrapper', udid: 'FAKE-0001' });
    await waitFor(() => backend.hasStream('FAKE-0001'));

    const wrappedSender = makeSender(42);
    // The wrapper has the same WebContents id but is a different JS object.
    const attachedSender = makeSender(42);
    await service.handle({ sender: attachedSender }, 'subscribeFrames', { udid: 'FAKE-0001' });
    await service.handle({ sender: wrappedSender }, 'subscribeFrames', { udid: 'FAKE-0001' });
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for simulator state');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

async function withService(
  run: (input: { service: ReturnType<typeof createAgentDeviceService>; backend: FakeDeviceBackend; sender: Sender }) => Promise<void>,
): Promise<void> {
  const stateDir = await mkdtemp(join(tmpdir(), 'cedia-device-service-'));
  const backend = new FakeDeviceBackend();
  const service = createAgentDeviceService({ platform: 'darwin', stateDir, backend });
  const sender = makeSender();
  try {
    await run({ service, backend, sender });
  } finally {
    await service.dispose();
    await rm(stateDir, { recursive: true, force: true });
  }
}

it('routes Synara simulator lifecycle, input, and state events through the native service', async () => {
  await withService(async ({ service, backend, sender }) => {
    const list = await service.handle({ sender }, 'list', { includeShutdown: true }) as any;
    expect(list.devices.some((device: any) => device.udid === 'FAKE-0001')).toBe(true);
    expect(list.availability.kind).toBe('available');

    await service.handle({ sender }, 'subscribeEvents', {});
    await service.handle({ sender }, 'boot', { udid: 'FAKE-0001' });
    const state = await service.handle({ sender }, 'attach', { threadId: 'thread-device-1', udid: 'FAKE-0001' }) as any;
    expect(state.attachedDeviceUdid).toBe('FAKE-0001');
    await waitFor(() => backend.hasStream('FAKE-0001'));

    expect(sender.sent.some((item) => item.channel === 'vscode:cediaAgentDevice')).toBe(true);
    await service.handle({ sender }, 'tap', { udid: 'FAKE-0001', x: 120, y: 240 });
    await service.handle({ sender }, 'typeText', { udid: 'FAKE-0001', text: 'hello simulator' });
    await service.handle({ sender }, 'typeText', { udid: 'FAKE-0001', text: '  \n' });
    expect(backend.callsOfKind('tap')).toHaveLength(1);
    expect(backend.callsOfKind('typeText')).toHaveLength(2);
    expect(backend.callsOfKind('typeText')[1]?.text).toBe('  \n');
  });
});

it('fans out the exact Synara device-frame envelope over the native IPC channel', async () => {
  await withService(async ({ service, backend, sender }) => {
    await service.handle({ sender }, 'boot', { udid: 'FAKE-0001' });
    await service.handle({ sender }, 'attach', { threadId: 'thread-device-2', udid: 'FAKE-0001' });
    await waitFor(() => backend.hasStream('FAKE-0001'));
    await service.handle({ sender }, 'subscribeFrames', { udid: 'FAKE-0001' });

    backend.emitFrame('FAKE-0001', {
      sequence: 17,
      timestampMs: 1234,
      keyframe: true,
      codecConfig: true,
      data: new Uint8Array([0, 1, 2, 3]),
    });

    const event = sender.sent.find((item) => item.channel === 'vscode:cediaAgentDeviceFrames');
    expect(event).toBeDefined();
    expect(event?.payload).toEqual({
      udid: 'FAKE-0001',
      sequence: 17,
      dataBase64: expect.any(String),
    });
    const payload = event?.payload as { dataBase64: string };
    const decoded = decodeDeviceFrame(Uint8Array.from(Buffer.from(payload.dataBase64, 'base64')));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.frame.header.deviceId).toBe('FAKE-0001');
      expect(decoded.frame.header.sequence).toBe(17);
      expect(decoded.frame.header.codecConfig).toBe(true);
      expect([...decoded.frame.payload]).toEqual([0, 1, 2, 3]);
    }

    await service.handle({ sender }, 'requestResync', { udid: 'FAKE-0001' });
    await service.handle({ sender }, 'unsubscribeFrames', { udid: 'FAKE-0001' });
    await waitFor(() => !backend.hasStream('FAKE-0001'));
  });
});

it('cleans all sender-owned frame subscriptions when the renderer is destroyed', async () => {
  await withService(async ({ service, backend, sender }) => {
    await service.handle({ sender }, 'boot', { udid: 'FAKE-0001' });
    await service.handle({ sender }, 'attach', { threadId: 'thread-device-3', udid: 'FAKE-0001' });
    await waitFor(() => backend.hasStream('FAKE-0001'));
    await service.handle({ sender }, 'subscribeFrames', { udid: 'FAKE-0001' });
    sender.destroy();
    await waitFor(() => !backend.hasStream('FAKE-0001'));
    const before = sender.sent.length;
    backend.emitFrame('FAKE-0001');
    expect(sender.sent).toHaveLength(before);
  });
});

it('rejects malformed or unauthorized frame requests at the IPC boundary', async () => {
  await withService(async ({ service, sender }) => {
    await expect(service.handle({ sender }, 'subscribeFrames', { udid: 'bad udid' })).rejects.toThrow('device');
    await expect(service.handle({ sender }, 'subscribeFrames', { udid: 'FAKE-0001' })).rejects.toThrow('attached');
    await expect(service.handle({ sender }, 'tap', { udid: 'FAKE-0001', x: -1, y: 2 })).rejects.toThrow('coordinate');
  });
});

it('uses the native bridge for Synara device methods and decodes IPC frame envelopes', async () => {
  const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>();
  const calls: Array<{ method: string; input: unknown }> = [];
  const bridge = {
    invoke: async (_channel: string, request: any) => {
      calls.push({ method: request.method, input: request.input });
      return request.method === 'list' ? { devices: [], availability: { kind: 'available' } } : undefined;
    },
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => { listeners.set(channel, listener); },
    removeListener: (channel: string) => { listeners.delete(channel); },
  };
  const api = createNativeDeviceApi(bridge);
  await api.list({ includeShutdown: true });
  const unsubscribeEvents = api.onEvent(() => undefined);
  expect(calls.map((call) => call.method)).toContain('subscribeEvents');
  unsubscribeEvents();
  expect(calls.map((call) => call.method)).toContain('unsubscribeEvents');

  const frames: unknown[] = [];
  const resets: string[] = [];
  const removeInstaller = installNativeDeviceFrameSource(bridge);
  const globals = globalThis as typeof globalThis & {
    __cediaNativeDeviceFrameSource?: (options: any) => any;
  };
  const source = globals.__cediaNativeDeviceFrameSource?.({
    udid: 'FAKE-0001',
    handlers: { onFrame: (frame: unknown) => frames.push(frame), onReset: (reason: string) => resets.push(reason) },
  });
  expect(source).toBeDefined();
  await Promise.resolve();
  listeners.get('vscode:cediaAgentDeviceFrames')?.({}, {
    udid: 'FAKE-0001',
    sequence: 1,
    dataBase64: Buffer.from(encodeDeviceFrame({
      header: { deviceId: 'FAKE-0001', sequence: 1, timestampMs: 1, keyframe: true, codecConfig: false },
      payload: new Uint8Array([7, 8]),
    })).toString('base64'),
  });
  expect(frames).toHaveLength(1);
  expect(resets).toHaveLength(0);
  source?.requestResync();
  source?.close();
  expect(calls.map((call) => call.method)).toContain('ackFrame');
  expect(calls.map((call) => call.method)).toContain('unsubscribeFrames');
  removeInstaller();
});

it('keeps one native frame subscription for multiple sources and reports subscribe errors', async () => {
  const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>();
  const calls: string[] = [];
  let rejectSubscribe = false;
  const bridge = {
    invoke: async (_channel: string, request: any) => {
      calls.push(request.method);
      if (request.method === 'subscribeFrames' && rejectSubscribe) throw new Error('not attached');
      return undefined;
    },
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => { listeners.set(channel, listener); },
    removeListener: (channel: string) => { listeners.delete(channel); },
  };
  const removeInstaller = installNativeDeviceFrameSource(bridge);
  const globals = globalThis as typeof globalThis & { __cediaNativeDeviceFrameSource?: (options: any) => any };
  const first = globals.__cediaNativeDeviceFrameSource?.({ udid: 'FAKE-0001', handlers: { onFrame: () => undefined, onReset: () => undefined } });
  const second = globals.__cediaNativeDeviceFrameSource?.({ udid: 'FAKE-0001', handlers: { onFrame: () => undefined, onReset: () => undefined } });
  await Promise.resolve();
  expect(calls.filter((method) => method === 'subscribeFrames')).toHaveLength(1);
  first?.close();
  expect(calls.filter((method) => method === 'unsubscribeFrames')).toHaveLength(0);
  second?.close();
  expect(calls.filter((method) => method === 'unsubscribeFrames')).toHaveLength(1);
  removeInstaller();

  rejectSubscribe = true;
  const resets: string[] = [];
  const removeErrorInstaller = installNativeDeviceFrameSource(bridge);
  const failed = globals.__cediaNativeDeviceFrameSource?.({ udid: 'FAKE-0001', handlers: { onFrame: () => undefined, onReset: (reason: string) => resets.push(reason) } });
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(failed).toBeDefined();
  expect(resets).toEqual(['error']);
  failed?.close();
  removeErrorInstaller();
  void listeners;
});

it('acknowledges malformed native frames so the bounded host queue cannot stall', async () => {
  const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>();
  const calls: Array<{ method: string; input: any }> = [];
  const bridge = {
    invoke: async (_channel: string, request: any) => { calls.push({ method: request.method, input: request.input }); },
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => { listeners.set(channel, listener); },
    removeListener: (channel: string) => { listeners.delete(channel); },
  };
  const removeInstaller = installNativeDeviceFrameSource(bridge);
  const globals = globalThis as typeof globalThis & { __cediaNativeDeviceFrameSource?: (options: any) => any };
  const resets: string[] = [];
  const source = globals.__cediaNativeDeviceFrameSource?.({ udid: 'FAKE-0001', handlers: { onFrame: () => undefined, onReset: (reason: string) => resets.push(reason) } });
  await Promise.resolve();
  listeners.get('vscode:cediaAgentDeviceFrames')?.({}, { udid: 'FAKE-0001', sequence: 22, dataBase64: 'not-base64-%%%'});
  expect(resets).toEqual(['decode-failed']);
  expect(calls.some((call) => call.method === 'ackFrame' && call.input.sequence === 22)).toBe(true);
  source?.close();
  removeInstaller();
});
