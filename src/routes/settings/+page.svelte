<script lang="ts">
	import {
		animatedWater,
		blurEnabled,
		fakeLoggedIn,
		fakeStaffRole,
		glassMode,
		useWebGPU,
	} from "#lib/dev-settings.svelte.js";
	import Glass from "#lib/render/glass.svelte";
	import { glassRenderer } from "#lib/render/panes.svelte.js";

	import { staffMenus, type StaffRole } from "#lib/staff.js";

	const staffRoles = Object.keys(staffMenus) as StaffRole[];
	const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
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

	<label class="flex items-center gap-2">
		Fake staff role (/staff menu)
		<select bind:value={fakeStaffRole.current} class="py-0 text-sm">
			{#each staffRoles as role (role)}
				<option value={role}>{role} ({staffMenus[role].title})</option>
			{/each}
		</select>
	</label>

	<label class="flex items-center gap-2">
		<input type="checkbox" bind:checked={useWebGPU.current} />
		useWebGPU (water background; off = static image)
	</label>
	<p class="ps-6">navigator.gpu: {hasWebGPU ? "available" : "missing → always static"}</p>

	<fieldset class="flex flex-col gap-1">
		<legend>&lt;Glass&gt; (now rendering: {glassRenderer.mode})</legend>
		<label class="flex items-center gap-2">
			<input type="radio" value="full" bind:group={glassMode.current} disabled={!useWebGPU.current} />
			full: WebGPU refraction, fill and rim (needs useWebGPU; else falls back to rim)
		</label>
		<label class="flex items-center gap-2">
			<input type="radio" value="rim" bind:group={glassMode.current} />
			rim: WebGPU rim highlight only, CSS blur and fill
		</label>
		<label class="flex items-center gap-2">
			<input type="radio" value="css" bind:group={glassMode.current} />
			css: no WebGPU (CSS blur, fill and masked rim)
		</label>
	</fieldset>

	<label class="flex items-center gap-2">
		<input type="checkbox" bind:checked={animatedWater.current} disabled={!useWebGPU.current} />
		animated (WebGPU only, off with reduced motion)
	</label>

	<section class="flex flex-col gap-3">
		<h2 class="text-base">&lt;Glass&gt; preview</h2>
		<div class="grid grid-cols-2 gap-3 text-brand-mist">
			<Glass class="flex h-28 flex-col justify-end rounded-lg p-3">variant="dark"</Glass>
			<Glass variant="light" class="flex h-28 flex-col justify-end rounded-lg p-3">
				variant="light"
			</Glass>
			<Glass class="col-span-2 rounded-full px-4 py-3 text-center">rounded-full</Glass>
			<Glass class="flex h-48 items-end rounded-3xl p-4">rounded-3xl, tall</Glass>
			<Glass options={{ highlightWidth: 2, highlightAlpha: 0.8 }} class="flex h-48 items-end rounded-xl p-4">
				options: highlightWidth 2, alpha 0.8
			</Glass>
		</div>
	</section>
</main>
