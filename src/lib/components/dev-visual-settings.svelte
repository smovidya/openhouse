<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";
	import {
		backgroundMode,
		blurEnabled,
		fakeStaffRole,
		glassMode,
		type BackgroundMode,
	} from "#lib/dev-settings.svelte.js";
	import type { GlassMode } from "#lib/render/frame-plan.js";
	import { glassRenderer } from "#lib/render/panes.svelte.js";
	import { staffMenus, type StaffRole } from "#lib/staff.js";

	const staffRoles = Object.keys(staffMenus) as StaffRole[];
	const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
	const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");

	const BACKGROUNDS: { value: BackgroundMode; label: string; hint: string; gpu: boolean }[] = [
		{ value: "animated", label: "Animated water", hint: "WebGPU caustics, looping", gpu: true },
		{ value: "still", label: "Still water", hint: "WebGPU caustics, one frame", gpu: true },
		{ value: "image", label: "Static image", hint: "no WebGPU", gpu: false },
	];
	const GLASSES: { value: GlassMode; label: string; hint: string }[] = [
		{ value: "full", label: "Liquid glass", hint: "WebGPU refraction, fill and rim" },
		{ value: "rim", label: "CSS glass + WebGPU rim", hint: "CSS blur and fill, WebGPU edge highlight" },
		{ value: "css", label: "CSS only", hint: "no WebGPU" },
	];
	const GLASS_NAMES = Object.fromEntries(GLASSES.map((g) => [g.value, g.label])) as Record<GlassMode, string>;

	/** What is actually showing, and why when it isn't what was picked. */
	const backgroundNow = $derived.by(() => {
		if (backgroundMode.current === "image") return "Static image";
		if (!hasWebGPU) return "Static image: this browser has no WebGPU";
		if (!glassRenderer.water) return "Starting WebGPU…";
		if (backgroundMode.current === "animated" && reducedMotion.current) {
			return "Still water: reduced motion is on";
		}
		return backgroundMode.current === "animated" ? "Animated water" : "Still water";
	});
	const glassNow = $derived.by(() => {
		const actual = GLASS_NAMES[glassRenderer.mode];
		if (glassMode.current === "css") return actual;
		if (!hasWebGPU) return `${actual}: this browser has no WebGPU`;
		if (glassMode.current === "full" && backgroundMode.current === "image") {
			return `${GLASS_NAMES.rim}: liquid glass needs the WebGPU water`;
		}
		if (glassRenderer.mode === "css") return "Starting WebGPU…";
		return actual;
	});
</script>

<div class="flex flex-col gap-5">
	<fieldset class="flex flex-col gap-1">
		<legend class="mb-1 font-bold">Background</legend>
		{#each BACKGROUNDS as option (option.value)}
			<label class="flex items-start gap-2">
				<input
					type="radio"
					value={option.value}
					bind:group={backgroundMode.current}
					disabled={option.gpu && !hasWebGPU}
					class="mt-1"
				/>
				<span>{option.label} <span class="opacity-60">· {option.hint}</span></span>
			</label>
		{/each}
		<p class="opacity-60">Now: {backgroundNow}</p>
	</fieldset>

	<fieldset class="flex flex-col gap-1">
		<legend class="mb-1 font-bold">&lt;Glass&gt;</legend>
		{#each GLASSES as option (option.value)}
			{@const needsWater = option.value === "full" && backgroundMode.current === "image"}
			<label class="flex items-start gap-2">
				<input
					type="radio"
					value={option.value}
					bind:group={glassMode.current}
					disabled={option.value !== "css" && !hasWebGPU}
					class="mt-1"
				/>
				<span>
					{option.label} <span class="opacity-60">· {option.hint}</span>
					{#if needsWater}<span class="opacity-60"> (needs WebGPU water)</span>{/if}
				</span>
			</label>
		{/each}
		<p class="opacity-60">Now: {glassNow}</p>
		<a href="/settings" class="underline">Open the &lt;Glass&gt; preview page</a>
	</fieldset>

	<fieldset class="flex flex-col gap-1">
		<legend class="mb-1 font-bold">Performance</legend>
		<label class="flex items-start gap-2">
			<input
				type="checkbox"
				bind:checked={() => !blurEnabled.current, (off) => (blurEnabled.current = !off)}
				class="mt-1"
			/>
			<span>Turn off all backdrop blur <span class="opacity-60">· e.g. to test low-end GPUs</span></span>
		</label>
	</fieldset>

	<label class="flex flex-col gap-1">
		<span class="font-bold">Fake staff role <span class="font-normal opacity-60">· /staff menu</span></span>
		<!-- Matches the toolbar's inputs (its styles are scoped to dev-controls.svelte). -->
		<select
			bind:value={fakeStaffRole.current}
			class="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-50"
		>
			{#each staffRoles as role (role)}
				<option value={role}>{role} ({staffMenus[role].title})</option>
			{/each}
		</select>
	</label>
</div>
