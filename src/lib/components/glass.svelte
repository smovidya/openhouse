<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { registerGlass } from "#lib/liquid-glass.svelte.js";
	import type { GlassOptions, GlassVariant } from "#lib/shaders/liquid-glass.js";
	import { cn } from "#lib/utils.js";

	type Props = HTMLAttributes<HTMLElement> & {
		/** Element to render, e.g. "section" or "article". */
		as?: string;
		/** dark: black/30 scrim (cards). light: white diagonal gradient (QR card). */
		variant?: GlassVariant;
		/** WebGPU look overrides (refraction, dispersion, highlight…); see liquidGlassConfig. */
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
</script>

<!--
	Figma's GLASS effect ("card").
	With WebGPU, the water background renders the pane as real liquid glass into the canvas below
	(liquid-glass.wgsl). It lives inside the pane so the compositor scrolls it with the card, and
	`html[data-liquid-glass="on"]` shows it and strips the CSS. Without it, this CSS is a rough
	fallback: scrim/sheen per variant, inset-shadow rims, backdrop blur.
-->
<svelte:element
	this={as}
	class={cn(
		variant === "light"
			? "bg-linear-to-br from-white/25 via-white/5 to-white/15"
			: "bg-black/30 bg-[linear-gradient(160deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_45%)]",
		"shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_1px_0_0_rgb(255_255_255/0.2),inset_-1px_0_0_rgb(255_255_255/0.1),inset_0_-1px_0_rgb(255_255_255/0.15),inset_0_0_16px_rgb(255_255_255/0.08)]",
		"backdrop-blur-md",
		"relative isolate",
		className
	)}
	data-glass={variant}
	{...restProps}
>
	<canvas
		data-glass-canvas
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 -z-10 hidden size-full"
		{@attach registerGlass(() => options)}
	></canvas>
	{@render children()}
</svelte:element>
