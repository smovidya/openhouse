<script lang="ts">
	import './layout.css';
	import { dev } from '$app/env';
	import DevToolbar from '#lib/components/dev-toolbar.svelte';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import MenuBar from '#lib/components/menu-bar.svelte';
	import WaterBackground from '#lib/components/water-background.svelte';
	import { fakeLoggedIn, syncDevSettings } from '#lib/dev-settings.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	syncDevSettings();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<WaterBackground overlay={page.data.waterOverlay} tint={page.data.waterTint} />

<div class="flex min-h-dvh flex-col">
	<MenuBar loggedIn={Boolean(page.data.session) || (dev && fakeLoggedIn.current)} />
	{@render children()}
</div>

{#if dev}
	<DevToolbar />
{/if}
