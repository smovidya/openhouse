<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { liquidGlassConfig, registerGlass, requestGlassRedraw } from "#lib/liquid-glass.svelte.js";
	import type { GlassOptions, GlassVariant } from "#lib/shaders/liquid-glass.js";
	import { cn } from "#lib/utils.js";

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

	// The water background renders on demand; redraw this pane when its look changes.
	$effect(() => {
		JSON.stringify(options);
		requestGlassRedraw();
	});
</script>

<!--
	Figma's GLASS effect ("card").
	With WebGPU, the water background renders the pane as real liquid glass into the canvas below
	(liquid-glass.wgsl). It lives inside the pane so the compositor scrolls it with the card, and
	`html[data-liquid-glass="on"]` shows it and strips the CSS. Without it, this CSS is a rough
	fallback: the same surface tint, a blended directional rim, and saturated backdrop blur.
-->
<svelte:element
	this={as}
	class={cn(
		variant === "light" ? "bg-white/15" : "bg-black/30",
		"backdrop-blur-md backdrop-saturate-(--glass-vibrancy)",
		"relative isolate",
		className
	)}
	data-glass={variant}
	{...restProps}
	style:--glass-vibrancy={Math.max(0, look.vibrancy)}
	style:--glass-highlight-width="{Math.max(0, look.highlightWidth)}px"
	style:--glass-highlight-alpha={Math.max(0, Math.min(1, look.highlightAlpha))}
>
	<canvas
		data-glass-canvas
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 -z-10 hidden size-full"
		{@attach registerGlass(() => options)}
	></canvas>
	{@render children()}
</svelte:element>

<style>
	[data-glass]::before {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: var(--glass-highlight-width, 1px);
		pointer-events: none;
		background: linear-gradient(
			to bottom right,
			white 0% 33.333%,
			rgb(255 255 255 / 0) 50%,
			white 66.667% 100%
		);
		opacity: var(--glass-highlight-alpha, 0.5);
		/* Add light to the surface, like the shader's rim, instead of washing it out with white. */
		-webkit-mask: linear-gradient(white, white) content-box, linear-gradient(white, white);
		mask: linear-gradient(white, white) content-box, linear-gradient(white, white);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
	}

	/* Give the rim more contrast against the dark surface (default alpha: 0.5 → 0.75). */
	[data-glass="dark"]::before {
		opacity: clamp(0, calc(var(--glass-highlight-alpha, 0.5) * 1.5), 1);
	}

	/* The WebGPU water background renders every <Glass> pane (refraction, scrim, highlights);
	   drop the CSS fallback look. */
	:global(:root[data-liquid-glass="on"]) [data-glass] {
		-webkit-backdrop-filter: none !important;
		backdrop-filter: none !important;
		background: none !important;
		box-shadow: none !important;
	}
	:global(:root[data-liquid-glass="on"]) [data-glass-canvas] {
		display: block;
	}
	:global(:root[data-liquid-glass="on"]) [data-glass]::before {
		display: none;
	}
</style>
