<script lang="ts">
	import { souvenirTiers, type SouvenirStats } from "#lib/features/dashboard/souvenirs.ts";

	let {
		stats,
		error = false,
	}: { stats?: SouvenirStats; error?: boolean } = $props();

	const number = new Intl.NumberFormat("th-TH");
	const updatedFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	const maxEligible = $derived(
		Math.max(1, ...(stats?.tiers.map((tier) => tier.eligible) ?? [0])),
	);

	function tierStats(id: string) {
		return stats?.tiers.find((tier) => tier.id === id);
	}
</script>

{#if error}
	<p role="alert" class="text-sm text-brand-yellow">
		โหลดสถิติไม่สำเร็จ กำลังลองใหม่อัตโนมัติ
	</p>
{:else if !stats}
	<p role="status" class="py-4 text-center text-sm text-white/60">
		กำลังโหลดสถิติของที่ระลึก…
	</p>
{:else}
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each souvenirTiers as tier, index (tier.id)}
			{@const row = tierStats(tier.id)}
			{@const eligible = row?.eligible ?? 0}
			{@const redeemed = row?.redeemed ?? null}
			<article class="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
				<div class="flex items-start gap-2">
					<span
						class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-yellow text-sm font-bold text-brand-navy"
						aria-hidden="true">{index === 0 ? "★" : 4 - index}</span
					>
					<div class="min-w-0">
						<h3 class="truncate text-sm font-medium text-brand-yellow">{tier.title}</h3>
						<p class="truncate text-xs text-white/60">{tier.prize}</p>
					</div>
				</div>
				<div class="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
					<div
						class="h-full bg-brand-yellow/30 transition-all duration-600"
						style="width: {(eligible / maxEligible) * 100}%"
						title="ผ่านเงื่อนไข {eligible} คน"
					></div>
					{#if redeemed !== null && redeemed > 0}
						<div
							class="h-full bg-brand-yellow transition-all duration-600"
							style="width: {(redeemed / maxEligible) * 100}%"
							title="รับรางวัลแล้ว {redeemed} คน"
						></div>
					{/if}
				</div>
				<p class="flex items-baseline justify-between gap-2 text-xs">
					<span class="text-white/60 tabular-nums">ผ่านเงื่อนไข
						<span class="text-base font-medium text-white">{number.format(eligible)}</span> คน</span
					>
					<span class="text-emerald-200 tabular-nums">
						{#if redeemed === null}
							จุดรับ: —
						{:else}
							รับแล้ว {number.format(redeemed)}
							{#if eligible > 0}
								({((redeemed / eligible) * 100).toFixed(0)}%)
							{/if}
						{/if}
					</span>
				</p>
			</article>
		{/each}
	</div>
	{#if stats.unmappedCheckpoints.length || stats.unmappedRedemptions}
		<p
			class="rounded-lg border border-amber-200/20 bg-amber-200/10 p-2 text-xs leading-relaxed text-amber-100"
		>
			ยังระบุระดับไม่ได้: {stats.unmappedCheckpoints.join(" · ") || "จุดรับรางวัลอื่น"}
			(ผู้รับ {number.format(stats.unmappedRedemptions)} คน) กรุณาตั้งชื่อจุดรับรางวัลให้ตรงกับชื่อระดับหรือของรางวัล
		</p>
	{/if}
	<p class="text-[10px] text-white/45">
		แต่ละคนมีสิทธิ์ได้หลายระดับ อย่านำยอดแต่ละระดับมารวมกัน · อัปเดต
		{updatedFormat.format(new Date(stats.updatedAt))} น. · อัปเดตทุก 30 วินาที
	</p>
{/if}
