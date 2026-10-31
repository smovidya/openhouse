<script lang="ts" module>
	export type RewardTier = {
		title: string;
		/** `done` is null when the attendee's progress isn't known. */
		conditions: { label: string; done: number | null; total: number }[];
		rewards: readonly string[];
		/** Photos of the rewards, in the same order: a square thumbnail and a larger one to open. */
		images: readonly { thumb: string; full: string }[];
	};
</script>

<script lang="ts">
	import Glass from "#lib/render/glass.svelte";
	import * as Dialog from "#lib/components/ui/dialog/index.js";

	let { tier }: { tier: RewardTier } = $props();

	const met = $derived(tier.conditions.every((condition) => condition.done === condition.total));

	/** The photo opened in the popup. Closing keeps it, so the popup still shows it as it fades out. */
	let preview = $state<{ src: string; name: string } | null>(null);
	let previewOpen = $state(false);
</script>

<Glass as="article" class="rounded-lg flex flex-col gap-3 p-3">
	<div class="flex items-center justify-between gap-2">
		<h3 class="text-lg font-medium text-brand-yellow">{tier.title}</h3>
		{#if met}
			<span class="rounded-full bg-status-green px-2 py-0.5 text-xs font-medium text-brand-navy">ผ่านเงื่อนไขแล้ว</span>
		{/if}
	</div>

	<div class="flex items-center gap-3">
		<div class="flex shrink-0 gap-1.5">
			{#each tier.images as image, i (image.full)}
				{@const name = tier.rewards[i] ?? ""}
				<button
					type="button"
					class="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-brand-yellow"
					aria-label="ดูรูป{name}"
					onclick={() => {
						preview = { src: image.full, name };
						previewOpen = true;
					}}
				>
					<img src={image.thumb} alt="" class="size-16 rounded-lg bg-white object-cover" />
				</button>
			{/each}
		</div>
		<div class="text-sm text-brand-mist">
			<p class="text-xs text-brand-sky">ของรางวัล</p>
			<p class="font-medium">{tier.rewards.join(" และ ")}</p>
		</div>
	</div>

	<ul class="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-black/20 px-3 py-2 text-xs text-brand-mist">
		{#each tier.conditions as condition (condition.label)}
			{@const done = condition.done === condition.total}
			<li class="flex items-center justify-between gap-2">
				<span>{condition.label}</span>
				<span class={["tabular-nums", done && "font-medium text-status-green"]}>
					{condition.done ?? "–"}/{condition.total}{#if done}<span aria-label="ผ่านเงื่อนไขแล้ว"> ✓</span>{/if}
				</span>
			</li>
		{/each}
	</ul>
</Glass>

<Dialog.Root bind:open={previewOpen}>
	<Dialog.Content class="gap-3 bg-transparent p-0 text-center ring-0" showCloseButton={false}>
		{#if preview}
			<!-- Tapping the photo closes it too. -->
			<Dialog.Close class="block w-full outline-none">
				<img src={preview.src} alt={preview.name} class="mx-auto max-h-[70vh] max-w-full rounded-xl" />
			</Dialog.Close>
			<Dialog.Title class="text-lg font-medium text-white">{preview.name}</Dialog.Title>
		{/if}
	</Dialog.Content>
</Dialog.Root>
