import { expect, it } from 'bun:test';
import { ensureSidechatSource } from '../vendor/synara/apps/web/src/lib/sidechatCreation';

it('promotes an OMP draft before forking it without sending a prompt', async () => {
  const commands: any[] = [];
  const input = { api: { orchestration: {
    getShellSnapshot: async () => ({ threads: [] }),
    dispatchCommand: async (command: any) => { commands.push(command); },
  } }, sourceThread: { id: 'draft', title: 'New thread', envMode: 'local' }, project: { id: 'project' },
  selectedModelSelection: { provider: 'omp', model: 'cedia:unresolved' }, runtimeMode: 'approval-required' };
  await ensureSidechatSource(input as any);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toMatchObject({ type: 'thread.create', threadId: 'draft', projectId: 'project' });
});

it('does not recreate a persisted source task', async () => {
  const commands: any[] = [];
  await ensureSidechatSource({ api: { orchestration: {
    getShellSnapshot: async () => ({ threads: [{ id: 'source' }] }),
    dispatchCommand: async (command: any) => { commands.push(command); },
  } }, sourceThread: { id: 'source' }, selectedModelSelection: { provider: 'omp' } } as any);
  expect(commands).toEqual([]);
});
