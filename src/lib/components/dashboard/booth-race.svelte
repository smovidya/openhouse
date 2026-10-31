<script lang="ts">
	import { flip } from "svelte/animate";
	import type { BoothStats } from "#lib/features/dashboard/types.ts";

	let { booths }: { booths: BoothStats[] } = $props();

	const typeLabels: Record<BoothStats["type"], string> = {
		booth: "บูธ",
		tcas: "TCAS",
		central_activity: "ส่วนกลาง",
	};

	const ranked = $derived(
		[...booths].sort((a, b) => b.scans - a.scans || a.name!.localeCompare(b.name ?? "")),
	);
	const max = $derived(Math.max(1, ...ranked.map((booth) => booth.scans)));
</script>

<div class="flex flex-col gap-2">
	{#each ranked as booth, index (booth.id)}
		<div
			class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
			animate:flip={{ duration: 400 }}
		>
			<span class="w-7 text-right font-heading text-sm text-white/60 tabular-nums">
				{index + 1}
			</span>
			<span class="w-32 shrink-0 truncate text-sm text-white">
				{booth.name ?? "บูธไม่มีชื่อ"}
			</span>
			<!-- Fixed-width type chip column so the progress bar keeps its own space. -->
			<span
				class="flex w-16 shrink-0 items-center justify-center rounded-full border border-white/20 py-0.5 text-center text-[10px] text-white/60 whitespace-nowrap"
			>
				{typeLabels[booth.type]}
			</span>
			<div class="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
				<div
					class="h-full rounded-full bg-brand-yellow transition-all duration-600"
					style="width: {(booth.scans / max) * 100}%"
				></div>
			</div>
			<span class="w-12 text-right text-sm text-brand-yellow tabular-nums">
				{booth.scans.toLocaleString("th-TH")}
			</span>
		</div>
	{/each}
	{#if ranked.length === 0}
		<p class="text-sm text-white/60">ยังไม่มีบูธในระบบ</p>
	{/if}
</div>