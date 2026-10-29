<script lang="ts">
	import { Tween } from "svelte/motion";

	let {
		label,
		value,
		suffix = "",
		denominator,
	}: {
		label: string;
		value: number;
		suffix?: string;
		denominator?: number;
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

<div class="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-4">
	<p class="text-xs tracking-wide text-white/60 uppercase">{label}</p>
	<p class="font-heading text-4xl font-medium text-brand-yellow tabular-nums">
		{Math.round(animated.current).toLocaleString("th-TH")}{suffix}
	</p>
	{#if percent !== null}
		<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
			<div
				class="h-full rounded-full bg-brand-yellow transition-all duration-600"
				style="width: {Math.min(percent, 100)}%"
			></div>
		</div>
		<p class="text-xs text-white/60 tabular-nums">
			{percent.toFixed(1)}% ของผู้ลงทะเบียน
		</p>
	{/if}
</div>