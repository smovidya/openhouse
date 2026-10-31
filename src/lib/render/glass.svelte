<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "#lib/utils.js";
	import type { GlassMode } from "./frame-plan.js";
	import { GlassPaneState, glassRenderer, liquidGlassConfig, requestGlassRedraw } from "./panes.svelte.js";
	import type { GlassOptions, GlassVariant } from "./shaders/liquid-glass.js";

	type Props = HTMLAttributes<HTMLElement> & {
		/** Element to render, e.g. "section" or "article". */
		as?: string;
		/** dark: black/30 scrim (cards). light: white/15 scrim (QR card). */
		variant?: GlassVariant;
		/** Look overrides; highlight width/strength and vibrancy also apply to the CSS fallback. */
		options?: Partial<GlassOptions>;
		children: Snippet;
	};

	let {
		as = "div",
		variant = "dark",
		options,
		class: className,
		children,
		...restProps
	}: Props = $props();
	const look = $derived({ ...liquidGlassConfig.defaults, ...options });

	const pane = new GlassPaneState(() => options);

	/**
	 * Every pane starts with the CSS look and crossfades to WebGPU:
	 *   css     — CSS look; the canvas (if any) is transparent until it holds a frame
	 *   fading  — the canvas fades in over the CSS look, the CSS rim fades out
	 *   settled — the fade ended: full glass drops the CSS blur + fill (hidden under the opaque
	 *             canvas anyway), and the CSS rim is gone
	 * Nothing is removed before the canvas covers it, so the swap never flickers.
	 */
	let faded = $state(false);
	const phase = $derived(!pane.drawn ? "css" : faded ? "settled" : "fading");
	const mode: GlassMode = $derived(phase === "css" ? "css" : glassRenderer.mode);

	$effect(() => {
		if (!pane.drawn) faded = false;
	});

	// The water background renders on demand; redraw this pane when its look changes.
	$effect(() => {
		JSON.stringify(options);
		requestGlassRedraw();
	});
</script>

<!--
	Figma's GLASS effect ("card"), in the mode the water background serves (see GlassMode), once
	this pane's canvas has faded in (see `phase`):
	- full: the canvas holds the whole pane (refracted, frosted water, fill, rim); no CSS look.
	- rim: CSS backdrop blur + fill, and the canvas adds the rim highlight.
	- css: CSS backdrop blur + fill + a masked gradient rim.
	The canvas lives inside the pane so the compositor scrolls it with the card.
-->
<svelte:element
	this={as}
	class={cn(
		!(mode === "full" && phase === "settled") && [
			variant === "light" ? "bg-white/30" : "bg-black/30",
			"backdrop-blur-md backdrop-saturate-(--glass-vibrancy)",
		],
		"relative isolate",
		className
	)}
	data-glass={variant}
	data-glass-mode={mode}
	data-glass-phase={phase}
	{...restProps}
	style:--glass-vibrancy={Math.max(0, look.vibrancy)}
	style:--glass-highlight-width="{Math.max(0, look.highlightWidth)}px"
	style:--glass-highlight-alpha={Math.max(0, Math.min(1, look.highlightAlpha))}
>
	{#if glassRenderer.mode !== "css"}
		<canvas
			aria-hidden="true"
			class={[
				"pointer-events-none absolute inset-0 -z-10 size-full transition-opacity duration-500",
				!pane.drawn && "opacity-0",
			]}
			{@attach pane.attach}
			ontransitionend={(event) => {
				if (event.propertyName === "opacity" && pane.drawn) faded = true;
			}}
		></canvas>
	{/if}
	{@render children()}
</svelte:element>

<style>
	/* CSS fallback rim: a blended directional gradient stroke. Fades out while the WebGPU canvas
	   fades in, and is dropped once that settles. */
	[data-glass-phase]:not([data-glass-phase="settled"])::before {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: var(--glass-highlight-width, 1px);
		pointer-events: none;
		/* The WebGPU rim's colour on sky pages (rim_color in liquid-glass.wgsl): white with a cast
		   of --brand-sky, so the CSS glass reads as blue as the WebGPU one. */
		--glass-rim-color: rgb(216 240 255);
		background: linear-gradient(
			to bottom right,
			var(--glass-rim-color) 0% 33.333%,
			transparent 50%,
			var(--glass-rim-color) 66.667% 100%
		);
		opacity: var(--glass-highlight-alpha, 0.5);
		/* Add light to the surface, like the shader's rim, instead of washing it out with white. */
		-webkit-mask: linear-gradient(white, white) content-box, linear-gradient(white, white);
		mask: linear-gradient(white, white) content-box, linear-gradient(white, white);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		transition: opacity 500ms;
	}
	[data-glass-phase="fading"]::before {
		opacity: 0 !important;
	}

	/* Give the rim more contrast against the dark surface (default alpha: 0.5 → 0.75). */
	[data-glass="dark"][data-glass-phase="css"]::before {
		opacity: clamp(0, calc(var(--glass-highlight-alpha, 0.5) * 1.5), 1);
	}
</style>
