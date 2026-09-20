import '../../index.css';
import { afterEach, expect, it, vi } from 'vitest';
import { render, cleanup } from 'vitest-browser-react';
import { ComposerModelPickerTabs, type ComposerModelPickerProviderTab } from './ComposerModelPickerTabs';
const tabs: ComposerModelPickerProviderTab[] = ['anthropic', 'openai', 'google'].map(id => ({
  provider: 'omp', tab: `upstream:${id}`, label: id, iconProvider: null,
  upstreamProviderId: id, unavailableLabel: null,
}));
afterEach(cleanup);
async function mount() {
  const reorder = vi.fn();
  const select = vi.fn();
  await render(<ComposerModelPickerTabs tab="upstream:anthropic" providerTabs={tabs} onTabChange={select} onReorder={reorder} />);
  const source = document.querySelector<HTMLButtonElement>('[data-provider-tab="upstream:anthropic"]')!;
  const target = document.querySelector<HTMLButtonElement>('[data-provider-tab="upstream:google"]')!;
  return { source, target, reorder, select };
}
function gesture(source: HTMLElement, target: HTMLElement, finish: 'pointerup' | 'pointercancel') {
  const start = source.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: start.x + 10, clientY: start.y + 10 }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: end.x + 10, clientY: end.y + 10 }));
  window.dispatchEvent(new PointerEvent(finish, { bubbles: true, pointerId: 1, clientX: end.x + 10, clientY: end.y + 10 }));
}
it('does not let native HTML drag cancel the pointer reorder gesture', async () => {
  const { source } = await mount();
  expect(source.draggable).toBe(false);
});
it('moves across provider tabs once and suppresses the release click', async () => {
  const { source, target, reorder, select } = await mount();
  gesture(source, target, 'pointerup');
  source.click();
  expect(reorder).toHaveBeenCalledExactlyOnceWith('upstream:anthropic', 'upstream:google');
  expect(select).not.toHaveBeenCalled();
});
it('cancels without committing when pointer capture is cancelled', async () => {
  const { source, target, reorder } = await mount();
  gesture(source, target, 'pointercancel');
  expect(reorder).not.toHaveBeenCalled();
});
it('still selects on an ordinary click without moving', async () => {
  const { source, reorder, select } = await mount();
  gesture(source, source, 'pointerup');
  source.click();
  expect(reorder).not.toHaveBeenCalled();
  expect(select).toHaveBeenCalledExactlyOnceWith('upstream:anthropic');
});
it('does not reorder when released outside the tab strip', async () => {
  const { source, target, reorder } = await mount();
  const start = source.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: start.x + 10, clientY: start.y + 10 }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: end.x + 10, clientY: end.y + 10 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: end.x + 10, clientY: end.bottom + 100 }));
  expect(reorder).not.toHaveBeenCalled();
});
