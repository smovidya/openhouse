<script lang="ts">
	import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
	import checkCircleIcon from "#lib/assets/icons/check-circle.svg";
	import Glass from "#lib/components/glass.svelte";
	import QrCode from "#lib/components/qr-code.svelte";
	import RewardTierCard from "#lib/components/reward-tier-card.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import WorkshopCard from "#lib/components/workshop-card.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const remaining = $derived(Math.max(0, data.workshopLimit - data.workshops.length));
</script>

<svelte:head>
	<title>MY QR CODE | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-col items-center gap-8 px-3 pt-6 pb-4">
	<SignBoard title="MY QR CODE" wide />

	<Glass
		as="section"
		variant="light"
		options={{ vibrancy: 1 }}
		class="rounded-xl flex flex-col gap-2 p-4 text-center text-brand-mist"
	>
		<QrCode value={data.profile.code} class="size-[227px]" />
		<div>
			<p class="text-xl">{data.profile.name}</p>
			<p class="text-sm">{data.profile.code}</p>
		</div>
	</Glass>

	<section class="flex w-full flex-col gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex flex-col text-brand-navy">
				<h2 class="text-2xl font-medium">My Workshops</h2>
				<p class="flex items-center gap-1 text-xs">
					เวิร์กช็อปที่ลงทะเบียนแล้ว ({data.workshops.length}/{data.workshopLimit})
					<img src={checkCircleIcon} alt="" />
				</p>
			</div>
			<!-- TODO: workshop list page doesn't exist yet. -->
			<Button variant="cta" size="cta-sm" href="/workshop">
				ดูทั้งหมด
				<img src={arrowRightIcon} alt="" />
			</Button>
		</div>

		{#each data.workshops as workshop (workshop.id)}
			<WorkshopCard {workshop} />
		{/each}

		{#if remaining > 0}
			<Glass class="rounded-lg flex flex-col items-center gap-2 p-3">
				<p class="text-center text-xs text-brand-mist">คุณลงทะเบียนได้อีก {remaining} เวิร์กช็อป</p>
				<Button variant="cta" size="cta-sm" href="/workshop">ลงทะเบียนเพิ่ม</Button>
			</Glass>
		{/if}
	</section>

	<section class="flex w-full flex-col gap-2">
		<div class="text-brand-navy">
			<h2 class="text-2xl font-medium">ภารกิจล่าของรางวัล</h2>
			<p class="text-xs">*เมื่อเลื่อนขั้นแล้วจะไม่สามารถแลกของรางวัลขั้นที่ต่ำกว่าได้</p>
		</div>
		{#each data.rewardTiers as tier (tier.title)}
			<RewardTierCard {tier} />
		{/each}
	</section>
</main>
