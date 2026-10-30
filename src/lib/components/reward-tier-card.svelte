<script lang="ts" module>
	export type RewardTier = {
		title: string;
		/** `done` is null when the attendee's progress isn't known. */
		conditions: { label: string; done: number | null; total: number }[];
		rewards: readonly string[];
	};
</script>

<script lang="ts">
	import trophyIcon from "#lib/assets/icons/trophy.svg";
	import { cn } from "#lib/utils.js";
	import Glass from "#lib/render/glass.svelte";

	/**
	 * After the gift is redeemed the cards become a sealed record: `locked` dims every card and
	 * `awarded` (the tier the attendee actually redeemed) is highlighted as already exchanged.
	 */
	let {
		tier,
		awarded = false,
		locked = false,
	}: { tier: RewardTier; awarded?: boolean; locked?: boolean } = $props();
</script>

<Glass
	as="article"
	class={cn(
		"rounded-lg flex flex-col gap-2 p-3",
		locked && !awarded && "opacity-60",
		awarded && "ring-2 ring-brand-yellow",
	)}
>
	<h3 class="text-center text-base font-medium text-brand-yellow">{tier.title}</h3>
	<div
		class={cn(
			"flex items-center gap-2 rounded-lg border p-2 text-xs",
			awarded
				? "border-status-green text-status-green"
				: "border-brand-sky text-brand-yellow",
		)}
	>
		<span class="flex shrink-0 items-center gap-1">
			<img src={trophyIcon} alt="" />
			{awarded ? "ปลดล็อคขั้นนี้แล้ว" : locked ? "เงื่อนไข (ประวัติสั่งสม):" : "เงื่อนไขปลดล็อค:"}
		</span>
		<ul class="grid flex-1 grid-cols-2 gap-x-2">
			{#each tier.conditions as condition (condition.label)}
				<li>
					{condition.label} {condition.done ?? "–"}/{condition.total}
					{#if condition.done === condition.total}
						<span aria-label="ผ่านเงื่อนไขแล้ว" class="text-status-green">✓</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<div class="text-xs text-brand-mist">
		<p>{awarded ? "ของรางวัลของขั้นนี้" : "ของรางวัลที่จะได้รับ"}</p>
		<ul class="list-disc">
			{#each tier.rewards as reward (reward)}
				<li class="ms-[18px]">{reward}</li>
			{/each}
		</ul>
	</div>
</Glass>