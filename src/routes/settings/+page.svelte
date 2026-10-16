<script lang="ts">
	import {
		animatedWater,
		blurEnabled,
		fakeLoggedIn,
		fakeStaffRole,
		useWebGPU,
	} from "#lib/dev-settings.svelte.js";

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

	<label class="flex items-center gap-2">
		<input type="checkbox" bind:checked={animatedWater.current} disabled={!useWebGPU.current} />
		animated (WebGPU only, off with reduced motion)
	</label>
</main>
