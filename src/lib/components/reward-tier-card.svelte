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
	import Glass from "#lib/render/glass.svelte";

	let { tier }: { tier: RewardTier } = $props();
</script>

<Glass as="article" class="rounded-lg flex flex-col gap-2 p-3">
	<h3 class="text-center text-base font-medium text-brand-yellow">{tier.title}</h3>
	<div class="flex items-center gap-2 rounded-lg border border-brand-sky p-2 text-xs text-brand-yellow">
		<span class="flex shrink-0 items-center gap-1">
			<img src={trophyIcon} alt="" />
			เงื่อนไขปลดล็อค:
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
		<p>ของรางวัลที่จะได้รับ</p>
		<ul class="list-disc">
			{#each tier.rewards as reward (reward)}
				<li class="ms-[18px]">{reward}</li>
			{/each}
		</ul>
	</div>
</Glass>
