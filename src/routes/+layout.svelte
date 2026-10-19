<script lang="ts">
	import './layout.css';
	import { browser, dev } from '$app/env';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import DevToolbar from '#lib/components/dev-toolbar.svelte';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import MenuBar from '#lib/components/menu-bar.svelte';
	import WaterBackground from '#lib/render/water-background.svelte';
	import FpsCounter from '#lib/components/fps-counter.svelte';
	import { showFps, syncDevSettings } from '#lib/dev-settings.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	syncDevSettings();

	// Client-side polling only (seat counts); nothing is fetched while server rendering.
	const queryClient = new QueryClient({
		defaultOptions: { queries: { enabled: browser } },
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<WaterBackground overlay={page.data.waterOverlay} tint={page.data.waterTint} />

<QueryClientProvider client={queryClient}>
	<div class="flex min-h-dvh flex-col">
		<MenuBar loggedIn={Boolean(page.data.session)} />
		{@render children()}
	</div>
</QueryClientProvider>

{#if dev}
	<DevToolbar />
	{#if showFps.current}
		<FpsCounter />
	{/if}
{/if}
