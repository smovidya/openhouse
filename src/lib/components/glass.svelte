<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "#lib/utils.js";

	type Props = HTMLAttributes<HTMLElement> & {
		/** Element to render, e.g. "section" or "article". */
		as?: string;
		children: Snippet;
	};

	let { as = "div", class: className, children, ...restProps }: Props = $props();
</script>

<!--
	Static stand-in for Figma's GLASS effect ("card"), no extra layers:
	- inset shadows: specular top edge, dimmer side/bottom rims, soft inner glow (follow border-radius)
	- background-image sheen over the bg-* fill colour; a bg-linear-* class on the card replaces it
-->
<svelte:element
	this={as}
	class={cn(
		"bg-[linear-gradient(160deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_45%)]",
		"shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_1px_0_0_rgb(255_255_255/0.2),inset_-1px_0_0_rgb(255_255_255/0.1),inset_0_-1px_0_rgb(255_255_255/0.15),inset_0_0_16px_rgb(255_255_255/0.08)]",
		"backdrop-blur-md",
		className
	)}
	{...restProps}
>
	{@render children()}
</svelte:element>
