<script lang="ts">
	import './layout.css';
	import { browser, dev } from '$app/env';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import DevToolbar from '#lib/components/dev-toolbar.svelte';
	import ErrorDialogHost from '#lib/components/error-dialog-host.svelte';
	import { page } from '$app/state';
	import appleTouchIcon from '#lib/assets/apple-touch-icon.png';
	import favicon from '#lib/assets/favicon.png';
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
	<link rel="icon" type="image/png" href={favicon} />
	<link rel="apple-touch-icon" href={appleTouchIcon} />
</svelte:head>

<WaterBackground overlay={page.data.waterOverlay} tint={page.data.waterTint} />

<QueryClientProvider client={queryClient}>
	<div class="flex min-h-dvh flex-col">
		<MenuBar loggedIn={Boolean(page.data.session)} staff={Boolean(page.data.session?.user.staff)} />
		{@render children()}
	</div>
</QueryClientProvider>

<!-- showError() (#lib/error-dialog.svelte.ts). -->
<ErrorDialogHost />

{#if dev}
	<DevToolbar />
	{#if showFps.current}
		<FpsCounter />
	{/if}
{/if}
