<script lang="ts">
	import './layout.css';
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

<WaterBackground overlay={page.data.waterOverlay} />

<div class="flex min-h-dvh flex-col">
	<!-- TODO: drive loggedIn from the session once auth exists. -->
	<MenuBar loggedIn={fakeLoggedIn.current} />
	{@render children()}
</div>
