<script lang="ts">
	import ropeBottom from "#lib/assets/countdown/rope-bottom.svg";
	import ropeTop from "#lib/assets/countdown/rope-top.svg";
	import WoodTile from "./wood-tile.svelte";

	/**
	 * ISO 8601 with offset, e.g. 2026-10-31T13:00:00+07:00. From `target` until `end` the tiles give
	 * way to a line saying the event is on, and after `end` to a thank-you.
	 */
	let { target, end }: { target: string; end: string } = $props();

	const endFormat = new Intl.DateTimeFormat("th-TH", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	// The rope path runs x = 0.225 → 402.225 and ends at its starting height, so copies placed
	// exactly 402px apart join seamlessly (the SVG box is ~1px wider, so bg-repeat leaves a step).
	const ROPE_PERIOD = 400.75; // slight overlap hides the anti-aliased joint
	const ROPE_COPIES = [-3, -2, -1, 0, 1, 2, 3];
	const ropeStyle = (url: string) =>
		[
			`background-image: ${ROPE_COPIES.map(() => `url("${url}")`).join(", ")}`,
			`background-position-x: ${ROPE_COPIES.map((k) => `calc(50% + ${k * ROPE_PERIOD}px)`).join(", ")}`,
		].join("; ");

	const targetMs = $derived(new Date(target).getTime());
	const endMs = $derived(new Date(end).getTime());
	let now = $state(Date.now());

	$effect(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const phase = $derived(now < targetMs ? "counting" : now < endMs ? "inProgress" : "ended");

	const units = $derived.by(() => {
		const total = Math.max(0, Math.floor((targetMs - now) / 1000));
		return [
			{ label: "วัน", value: Math.floor(total / 86_400) },
			{ label: "ชั่วโมง", value: Math.floor(total / 3_600) % 24 },
			{ label: "นาที", value: Math.floor(total / 60) % 60 },
			{ label: "วินาที", value: total % 60 },
		];
	});
</script>

{#if phase === "inProgress"}
	<div class="flex flex-col items-center gap-1 text-center text-brand-brown" role="status">
		<p class="font-heading text-[32px] font-medium">งานเริ่มแล้ว!</p>
		<p class="text-sm">เปิดถึง {endFormat.format(endMs)} น.</p>
	</div>
{:else if phase === "ended"}
	<div class="flex flex-col items-center gap-1 text-center text-brand-brown" role="status">
		<p class="font-heading text-[32px] font-medium">ขอบคุณที่มาร่วมงาน</p>
		<p class="text-sm">แล้วพบกันใหม่ปีหน้า</p>
	</div>
{:else}
	<div class="relative w-full" role="timer" aria-label="นับถอยหลังสู่วันงาน">
		<!-- Ropes behind the tiles, centred copies at natural size so they reach both screen edges
		     without stretching. Vertical offsets from Figma (rope line at 12.5px / 58px). -->
		<div
			class="absolute inset-x-0 top-[9.78px] h-[5.66px] bg-no-repeat bg-size-[auto_100%]"
			style={ropeStyle(ropeTop)}
		></div>
		<div
			class="absolute inset-x-0 top-[53.78px] h-[5.66px] bg-no-repeat bg-size-[auto_100%]"
			style={ropeStyle(ropeBottom)}
		></div>

		<div class="relative flex justify-center gap-4">
			{#each units as unit (unit.label)}
				<div class="flex w-17.5 flex-col items-center gap-2">
					<WoodTile value={String(unit.value).padStart(2, "0")} />
					<span class="text-center text-sm text-brand-brown">{unit.label}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
