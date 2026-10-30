<script lang="ts">
	import { BANGKOK_TIME_ZONE, EVENT_SCHEDULE } from "#lib/constants/time.ts";

	let { now = Date.now() }: { now?: number } = $props();

	const start = Date.parse(EVENT_SCHEDULE.eventStartsAt);
	const end = Date.parse(EVENT_SCHEDULE.eventEndsAt);

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: BANGKOK_TIME_ZONE,
	});
	const dateFormat = new Intl.DateTimeFormat("th-TH", {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: BANGKOK_TIME_ZONE,
	});
	const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		timeZone: BANGKOK_TIME_ZONE,
	});

	type State = "upcoming" | "live" | "ended";
	const state = $derived<State>(
		now < start ? "upcoming" : now < end ? "live" : "ended",
	);
	const stateLabels: Record<State, string> = {
		upcoming: "ก่อนเริ่มงาน",
		live: "งานกำลังดำเนิน",
		ended: "งานจบแล้ว",
	};
	const stateStyles: Record<State, string> = {
		upcoming: "border-amber-400/40 text-amber-300",
		live: "border-emerald-400/40 text-emerald-300",
		ended: "border-white/20 text-white/40",
	};

	const progress = $derived(
		Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
	);

	// Event day 1 (31 Oct) vs day 2 (1 Nov), keyed on Bangkok calendar dates.
	const eventDay = $derived.by(() => {
		if (state !== "live") return null;
		return dayKeyFormat.format(new Date(now)) ===
			dayKeyFormat.format(new Date(start))
			? 1
			: 2;
	});

	const countdown = $derived.by(() => {
		if (state === "ended") return null;
		const remaining = state === "live" ? end - now : start - now;
		const totalMinutes = Math.max(0, Math.floor(remaining / 60_000));
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return {
			hours,
			minutes,
			label: state === "live" ? "เหลือเวลางาน" : "นับถอยหลังเริ่มงาน",
		};
	});
</script>

<div class="flex h-full flex-col justify-between gap-3">
	<div class="flex items-start justify-between gap-3">
		<div>
			<p class="font-heading text-3xl leading-tight text-white tabular-nums">
				{timeFormat.format(now)}
			</p>
			<p class="text-xs text-white/60">{dateFormat.format(now)}</p>
		</div>
		<span
			class="rounded-full border px-2 py-0.5 text-xs whitespace-nowrap {stateStyles[state]}"
		>
			{#if state === "live"}
				<span class="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-emerald-400"></span>
			{/if}
			{stateLabels[state]}
		</span>
	</div>
	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between gap-3 text-xs">
			<span class="text-white/60">
				{#if eventDay}
					วันที่ {eventDay} ของงาน
				{:else}
					งาน {dateFormat.format(new Date(start))} – {dateFormat.format(
						new Date(end),
					)}
				{/if}
			</span>
			{#if countdown}
				<span class="text-brand-mist tabular-nums">
					{countdown.label} {countdown.hours > 0 ? `${countdown.hours} ชม. ` : ""}
					{countdown.minutes} นาที
				</span>
			{/if}
		</div>
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
			<div
				class="h-full rounded-full {state === 'live'
					? 'bg-brand-yellow'
					: 'bg-white/30'} transition-all duration-1000"
				style="width: {progress}%"
			></div>
		</div>
	</div>
</div>
