<script lang="ts">
	import HistoryList from "#lib/components/history-list.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { tierTitle } from "#lib/rewards.js";
	import type { PageProps } from "./$types";

	// Every reward handed out (Figma "บูธแลกของที่ระลึก / ประวัติการรับของรางวัล"): the latest 100.
	let { data }: PageProps = $props();

	const entries = $derived(
		data.redemptions.map((redemption) => ({
			...redemption,
			// Redemptions from before tiers and gifts were recorded have neither.
			detail: redemption.tier ? tierTitle(redemption.tier) : (redemption.giftName ?? "ของรางวัล"),
			at: redemption.createdAt,
		}))
	);
</script>

<svelte:head>
	<title>ประวัติการรับของรางวัล | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">บูธแลกของที่ระลึก</h1>

		<section class="flex flex-col gap-4">
			<h2 class="text-2xl text-brand-sky">ประวัติการรับของรางวัล</h2>
			<HistoryList {entries} empty="ยังไม่มีการแลกของรางวัล" />
		</section>
	</div>

	<Button variant="cta" size="cta-lg" href="/staff/rewards" class="w-full">ย้อนกลับ</Button>
</main>
