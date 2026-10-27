<script lang="ts">
	import ropeBottom from "#lib/assets/countdown/rope-bottom.svg";
	import ropeTop from "#lib/assets/countdown/rope-top.svg";
	import WoodTile from "./wood-tile.svelte";

	/** ISO 8601 with offset, e.g. 2026-10-31T13:00:00+07:00 */
	let { target }: { target: string } = $props();

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
	let now = $state(Date.now());

	$effect(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

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
