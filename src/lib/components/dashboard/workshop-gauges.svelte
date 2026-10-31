<script lang="ts">
	import type { WorkshopStats } from "#lib/features/dashboard/types.ts";
	import { BANGKOK_TIME_ZONE } from "#lib/constants/time.ts";

	let {
		workshops,
		now = Date.now(),
	}: { workshops: WorkshopStats[]; now?: number } = $props();

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: BANGKOK_TIME_ZONE,
	});

	const rounds = $derived(
		workshops.flatMap((workshop) =>
			workshop.rounds.map((round) => ({ ...round, title: workshop.title })),
		),
	);

	const totals = $derived.by(() => {
		let capacity = 0;
		let advance = 0;
		let walkIn = 0;
		let attended = 0;
		for (const round of rounds) {
			capacity += round.capacity;
			advance += round.advanceArrived;
			walkIn += round.walkInArrived;
			attended += round.attended;
		}
		return {
			capacity,
			advance,
			walkIn,
			attended,
			fill: capacity > 0 ? Math.min((attended / capacity) * 100, 100) : 0,
		};
	});

	const runningCount = $derived(
		rounds.filter((round) => {
			const start = Date.parse(round.startsAt);
			const end = Date.parse(round.endsAt);
			return now >= start && now < end;
		}).length,
	);

	const fullCount = $derived(
		rounds.filter(
			(round) => round.capacity > 0 && round.attended >= round.capacity,
		).length,
	);

	const nextRound = $derived.by(() => {
		const upcoming = rounds
			.filter((round) => Date.parse(round.startsAt) > now)
			.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
		return upcoming[0] ?? null;
	});

	const advanceWidth = $derived(
		totals.capacity > 0 ? (totals.advance / totals.capacity) * 100 : 0,
	);
	const walkInWidth = $derived(
		totals.capacity > 0 ? (totals.walkIn / totals.capacity) * 100 : 0,
	);

	const number = new Intl.NumberFormat("th-TH");
</script>

<div class="flex h-full flex-col justify-between gap-3">
	<div class="flex flex-wrap gap-2 text-xs">
		<span
			class="rounded-full border border-sky-400/40 px-2.5 py-1 text-sky-300 tabular-nums"
		>
			กำลังจัด {runningCount} รอบ
		</span>
		<span
			class="rounded-full border border-red-400/40 px-2.5 py-1 text-red-300 tabular-nums"
		>
			เต็ม {fullCount} รอบ
		</span>
		{#if nextRound}
			<span class="rounded-full border border-amber-400/40 px-2.5 py-1 text-amber-300 tabular-nums">
				รอบถัดไป {timeFormat.format(new Date(nextRound.startsAt))} น.
			</span>
		{:else if rounds.length > 0}
			<span class="rounded-full border border-white/20 px-2.5 py-1 text-white/40">
				ไม่มีรอบที่กำลังจะเริ่ม
			</span>
		{:else}
			<span class="rounded-full border border-white/20 px-2.5 py-1 text-white/40">
				ยังไม่มีเวิร์กชอป
			</span>
		{/if}
	</div>

	<div class="flex flex-col gap-1.5">
		<div class="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
			<div
				class="h-full bg-sky-400 transition-all duration-600"
				style="width: {advanceWidth}%"
				title="จองล่วงหน้ามาแล้ว {totals.advance} คน"
			></div>
			<div
				class="h-full bg-amber-400 transition-all duration-600"
				style="width: {walkInWidth}%"
				title="Walk-in ที่มาแล้ว {totals.walkIn} คน"
			></div>
		</div>
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
			<span class="text-white/60 tabular-nums">
				<span class="text-sky-300">{number.format(totals.advance)}</span> จองล่วงหน้า ·
				<span class="text-amber-300">{number.format(totals.walkIn)}</span> Walk-in
			</span>
			<span class="text-brand-mist tabular-nums">
				{number.format(totals.attended)}
				{#if totals.capacity > 0}/{number.format(totals.capacity)} ที่นั่ง{/if}
				({totals.fill.toFixed(0)}%)
			</span>
		</div>
	</div>
</div>
