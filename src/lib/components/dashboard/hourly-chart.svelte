<script lang="ts">
	let {
		hourly,
		hourlyEntry,
		now = Date.now(),
	}: {
		hourly: { hour: string; count: number }[];
		/** Hourly check-ins at entry checkpoints; enables the "entry" chart variant. */
		hourlyEntry?: { hour: string; count: number }[];
		now?: number;
	} = $props();

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	// Chart variant: all check-ins vs entry-only arrivals.
	type Variant = "all" | "entry";
	let variant = $state<Variant>("all");

	const series = $derived(variant === "all" ? hourly : (hourlyEntry ?? hourly));
	const max = $derived(Math.max(1, ...series.map((entry) => entry.count)));
	const peak = $derived(
		series.reduce<{ hour: string; count: number } | null>(
			(best, entry) => (!best || entry.count > best.count ? entry : best),
			null,
		),
	);
	const total = $derived(series.reduce((sum, entry) => sum + entry.count, 0));

	function isCurrentHour(hour: string) {
		const start = new Date(hour).getTime();
		return start <= now && now < start + 3_600_000;
	}
</script>

<div class="flex h-full flex-col gap-2">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-1 text-xs" role="tablist" aria-label="ข้อมูลรายชั่วโมง">
			<button
				type="button"
				role="tab"
				aria-selected={variant === "all"}
				class="rounded-full border px-2.5 py-0.5 transition-colors
				{variant === 'all'
					? 'border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow'
					: 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}"
				onclick={() => (variant = "all")}
			>
				ทุกจุด
			</button>
			{#if hourlyEntry}
				<button
					type="button"
					role="tab"
					aria-selected={variant === "entry"}
					class="rounded-full border px-2.5 py-0.5 transition-colors
					{variant === 'entry'
						? 'border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow'
						: 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}"
					onclick={() => (variant = "entry")}
				>
					เฉพาะจุดเข้าประตู
				</button>
			{/if}
		</div>
		<span class="text-[11px] text-white/60 tabular-nums" title="รวมทั้งงาน">
			รวม {total.toLocaleString("th-TH")}
		</span>
	</div>

	<div class="flex min-h-0 flex-1 items-end justify-between gap-1 overflow-x-auto" style="height: 120px;">
		{#each series as entry (entry.hour)}
			{@const current = isCurrentHour(entry.hour)}
			{@const isPeak = peak?.hour === entry.hour && peak.count > 0}
			<div class="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-1">
				<span class="text-[10px] text-white/60 tabular-nums">{entry.count}</span>
				<div
					class="w-full rounded-t transition-all duration-600
					{current
						? 'animate-pulse bg-brand-yellow'
						: isPeak
							? 'bg-brand-yellow/70'
							: 'bg-white/25'}"
					style="height: {Math.max(
						(entry.count / max) * 80,
						entry.count > 0 ? 6 : 2,
					)}px;"
				></div>
				<span class="text-[10px] text-white/60 tabular-nums">
					{timeFormat.format(new Date(entry.hour))} น.
				</span>
			</div>
		{:else}
			<p class="self-center text-sm text-white/60">ยังไม่มีข้อมูล</p>
		{/each}
	</div>
</div>
