<script lang="ts" module>
	// Thai has no spaces to wrap at: each header's lines are set by hand (Figma breaks tier names
	// before โจรสลัด the same way).
	const columns = [["ระดับ"], ["TCAS"], ["กิจกรรม", "กลาง"], ["บูธ", "ภาควิชา"], ["เวิร์ค", "ช็อป"], ["เวที"]];
	const PIRATE = "โจรสลัด";
	const rowClass = "grid grid-cols-[1.4fr_repeat(5,1fr)] items-center gap-1 rounded-lg px-2";
</script>

<script lang="ts">
	import type { ProgressCounts, RewardTier } from "#lib/features/checkpoints/progress.ts";
	import { rewardTiers } from "#lib/rewards.js";

	/**
	 * The reward tiers' conditions (Figma "เงื่อนไขแลกของรางวัลในแต่ละขั้น"): one row per tier. With
	 * `counts`, a highlighted ปัจจุบัน row shows the attendee's; `highlight` outlines a tier.
	 */
	let { counts = null, highlight = null }: { counts?: ProgressCounts | null; highlight?: RewardTier | null } =
		$props();

	const mark = (done: boolean) => (done ? "✓" : "✗");
</script>

<div
	role="table"
	aria-label="เงื่อนไขแลกของรางวัลในแต่ละขั้น"
	class="flex w-full flex-col gap-2 rounded-lg border-2 border-brand-sky bg-brand-mist p-3 text-sm break-words text-brand-navy"
>
	<div role="row" class={rowClass}>
		{#each columns as lines (lines.join(""))}
			<span role="columnheader">
				{#each lines as line, index (index)}
					{#if index > 0}<br />{/if}{line}
				{/each}
			</span>
		{/each}
	</div>
	{#if counts}
		<div role="row" class={[rowClass, "bg-brand-yellow py-2"]}>
			<span role="rowheader">ปัจจุบัน</span>
			<span role="cell">{mark(counts.hasTcas)}</span>
			<span role="cell">{mark(counts.hasCentralActivity)}</span>
			<span role="cell">{counts.departmentCount}</span>
			<span role="cell">{counts.workshopCount}</span>
			<span role="cell">{mark(counts.hasStage)}</span>
		</div>
	{/if}
	<hr class="border-brand-sky" />
	<div class="flex flex-col gap-3">
		{#each rewardTiers as tier (tier.tier)}
			<div
				role="row"
				aria-current={tier.tier === highlight || undefined}
				class={[rowClass, tier.tier === highlight && "border border-brand-yellow py-2"]}
			>
				<span role="rowheader">
					{#if tier.title.endsWith(PIRATE)}
						{tier.title.slice(0, -PIRATE.length)}<br />{PIRATE}
					{:else}
						{tier.title}
					{/if}
				</span>
				<span role="cell">✓</span>
				<span role="cell">✓</span>
				<span role="cell">{tier.departments}</span>
				<span role="cell">{tier.workshops || "–"}</span>
				<span role="cell">{tier.stage ? "✓" : "–"}</span>
			</div>
		{/each}
	</div>
</div>
