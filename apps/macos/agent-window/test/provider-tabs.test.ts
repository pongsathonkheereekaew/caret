import { expect, it } from 'bun:test';

import {
	buildProviderTabRows,
	moveComposerModelPickerUpstreamTab,
	resolveComposerModelPickerInitialTab,
	resolveComposerModelPickerUpstreamTabs,
} from '../vendor/synara/apps/web/src/components/chat/ComposerModelPicker.logic';
import { ProviderGlyphIcon, resolveProviderGlyphId } from '../vendor/synara/apps/web/src/components/ProviderIcon';

it('derives one user-facing tab per OMP upstream provider and never exposes OMP', () => {
	const options = [
		{
			slug: 'openai-codex/gpt-5.5',
			name: 'GPT-5.5',
			upstreamProviderId: 'openai-codex',
			upstreamProviderName: 'OpenAI Codex',
		},
		{
			slug: 'openai-codex/gpt-5.4',
			name: 'GPT-5.4',
			upstreamProviderId: 'openai-codex',
			upstreamProviderName: 'OpenAI Codex',
		},
		{
			slug: 'anthropic/claude-sonnet-4-6',
			name: 'Claude Sonnet 4.6',
			upstreamProviderId: 'anthropic',
			upstreamProviderName: 'Anthropic',
		},
		// A duplicated catalog row must not create a second tab or model row.
		{
			slug: 'openai-codex/gpt-5.5',
			name: 'GPT-5.5 (duplicate)',
			upstreamProviderId: 'openai-codex',
			upstreamProviderName: 'OpenAI Codex',
		},
	];

	const tabs = resolveComposerModelPickerUpstreamTabs(options);
	 expect(tabs.map((tab) => tab.label)).toEqual(['OpenAI Codex', 'Anthropic']);
	 expect(tabs.every((tab) => tab.provider === 'omp')).toBe(true);
	 expect(tabs.some((tab) => tab.label === 'OMP')).toBe(false);

	const openAiTab = tabs[0];
	 expect(openAiTab).toBeDefined();
	 expect(
		buildProviderTabRows({
			provider: 'omp',
			options,
			query: '',
			selectedModel: 'openai-codex/gpt-5.5',
			upstreamProviderId: openAiTab?.upstreamProviderId,
		}),
	).toHaveLength(2);
});

it('opens on the upstream tab that owns the selected provider-qualified model', () => {
	const options = [
		{
			slug: 'openai-codex/gpt-5.5',
			name: 'GPT-5.5',
			upstreamProviderId: 'openai-codex',
			upstreamProviderName: 'OpenAI Codex',
		},
		{
			slug: 'anthropic/claude-sonnet-4-6',
			name: 'Claude Sonnet 4.6',
			upstreamProviderId: 'anthropic',
			upstreamProviderName: 'Anthropic',
		},
	];
	const tabs = resolveComposerModelPickerUpstreamTabs(options);

	 expect(
		resolveComposerModelPickerInitialTab({
			provider: 'omp',
			model: 'anthropic/claude-sonnet-4-6',
			options,
			upstreamTabs: tabs,
		}),
	).toBe(tabs[1]?.tab);
});

it('moves upstream provider tabs without changing their stable ids', () => {
	const tabs = resolveComposerModelPickerUpstreamTabs([
		{ slug: 'openai/gpt', name: 'GPT', upstreamProviderId: 'openai', upstreamProviderName: 'OpenAI' },
		{ slug: 'anthropic/claude', name: 'Claude', upstreamProviderId: 'anthropic', upstreamProviderName: 'Anthropic' },
	]);
	expect(moveComposerModelPickerUpstreamTab(tabs, 'upstream:anthropic', 'upstream:openai').map(tab => tab.tab)).toEqual([
		'upstream:anthropic',
		'upstream:openai',
	]);
});

it('resolves bundled marks for upstream providers instead of falling back to a globe', () => {
	 expect(resolveProviderGlyphId('openrouter')).toBe('openrouter');
	 expect(resolveProviderGlyphId('openai-codex')).toBe('openai');
	 expect(resolveProviderGlyphId('anthropic')).toBe('anthropic');
	 expect(resolveProviderGlyphId('meta-llama')).toBe('meta');
	 expect(resolveProviderGlyphId('unknown-provider')).toBeNull();
});

it('renders a real SVG mark after provider-id resolution', () => {
	 const element = ProviderGlyphIcon({ providerId: 'mistralai', className: 'mark' });
	 expect(element.type).toBe('svg');
	 expect(element.props.viewBox).toBe('0 0 24 24');
	 expect(element.props.children.length).toBeGreaterThan(0);
	 const commandCode = ProviderGlyphIcon({ providerId: 'commandcode', className: 'mark' });
	 expect(commandCode.type).toBe('svg');
	 expect(commandCode.props.viewBox).toBe('0 0 137 137');
	 expect(commandCode.props.children.type).toBe('image');
	 expect(commandCode.props.children.props.href).toContain('commandcode.svg');
});
