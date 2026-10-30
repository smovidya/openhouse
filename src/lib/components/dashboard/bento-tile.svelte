<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title = "",
		description = "",
		eyebrow = "",
		class: className = "",
		children,
		footer,
	}: {
		title?: string;
		description?: string;
		eyebrow?: string;
		class?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<section
	class="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 {className}"
	aria-label={title}
>
	{#if title}
		<header class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<div>
				{#if eyebrow}
					<p class="text-[10px] tracking-[0.14em] text-brand-yellow/80 uppercase">
						{eyebrow}
					</p>
				{/if}
				<h2 class="font-heading text-lg leading-tight font-medium text-brand-yellow">
					{title}
				</h2>
			</div>
			{#if description}
				<p class="text-xs text-white/50">{description}</p>
			{/if}
		</header>
	{/if}
	{@render children()}
	{#if footer}
		{@render footer()}
	{/if}
</section>
