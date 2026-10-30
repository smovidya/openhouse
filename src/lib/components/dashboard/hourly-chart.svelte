<script lang="ts">
	let {
		hourly,
		now = Date.now(),
	}: { hourly: { hour: string; count: number }[]; now?: number } = $props();

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	const max = $derived(Math.max(1, ...hourly.map((entry) => entry.count)));
	const peak = $derived(
		hourly.reduce<{ hour: string; count: number } | null>(
			(best, entry) => (!best || entry.count > best.count ? entry : best),
			null,
		),
	);

	function isCurrentHour(hour: string) {
		const start = new Date(hour).getTime();
		return start <= now && now < start + 3_600_000;
	}
</script>

<div class="flex h-full items-end justify-between gap-1 overflow-x-auto" style="height: 120px;">
	{#each hourly as entry (entry.hour)}
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
