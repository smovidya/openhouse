<script lang="ts">
	import { blurEnabled, fakeLoggedIn } from "#lib/dev-settings.svelte.js";
</script>

<svelte:head>
	<title>Dev settings</title>
</svelte:head>

<main class="flex flex-col gap-4 p-4 font-mono text-sm">
	<h1 class="text-xl">Dev settings</h1>
	<p>Stored in localStorage, this browser only. Page 404s outside dev.</p>

	<label class="flex items-center gap-2">
		<input type="checkbox" bind:checked={blurEnabled.current} />
		Enable blur (backdrop-filter)
	</label>

	<label class="flex items-center gap-2">
		<input type="checkbox" bind:checked={fakeLoggedIn.current} />
		Fake logged in (navbar variant)
	</label>
</main>
