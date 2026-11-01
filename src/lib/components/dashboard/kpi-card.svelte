<script lang="ts">
	import { Tween } from "svelte/motion";
	import type { DaySplit } from "#lib/features/dashboard/types.ts";

	let {
		label,
		value,
		suffix = "",
		denominator,
		split,
	}: {
		label: string;
		value: number;
		suffix?: string;
		denominator?: number;
		/** When given, shows the two event-day counts plus a separate sum row. */
		split?: DaySplit;
	} = $props();

	// Tween toward the latest value; initialized lazily so it follows `value`.
	const animated = new Tween(0, { duration: 600 });
	$effect(() => {
		animated.target = value;
	});

	const percent = $derived.by(() => {
		const current = denominator === undefined ? 0 : denominator;
		return current > 0 ? (animated.current / current) * 100 : null;
	});
</script>

<div class="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 p-3">
	<p class="text-[11px] tracking-wide text-white/60 uppercase">{label}</p>
	<p class="font-heading text-3xl font-medium text-brand-yellow tabular-nums">
		{Math.round(animated.current).toLocaleString("th-TH")}{suffix}
	</p>
	{#if percent !== null}
		<div class="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
			<div
				class="h-full rounded-full bg-brand-yellow transition-all duration-600"
				style="width: {Math.min(percent, 100)}%"
			></div>
		</div>
		<p class="text-[11px] text-white/60 tabular-nums">
			{percent.toFixed(1)}% ของผู้ลงทะเบียน
		</p>
	{/if}
	{#if split}
		<div class="mt-1 grid grid-cols-3 gap-1 border-t border-white/10 pt-1">
			<div class="flex flex-col">
				<span class="text-[10px] text-white/40">วันแรก</span>
				<span class="text-sm font-medium text-white tabular-nums">
					{split.day1.toLocaleString("th-TH")}
				</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] text-white/40">วันที่สอง</span>
				<span class="text-sm font-medium text-white tabular-nums">
					{split.day2.toLocaleString("th-TH")}
				</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] text-brand-yellow">รวม</span>
				<span class="text-sm font-semibold text-brand-yellow tabular-nums">
					{split.total.toLocaleString("th-TH")}
				</span>
			</div>
		</div>
	{/if}
</div>