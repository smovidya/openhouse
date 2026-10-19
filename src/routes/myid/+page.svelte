<script lang="ts">
	import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
	import checkCircleIcon from "#lib/assets/icons/check-circle.svg";
	import Glass from "#lib/render/glass.svelte";
	import QrCode from "#lib/components/qr-code.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import WorkshopCard from "#lib/components/workshop-card.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { BANGKOK_TIME_ZONE, EVENT_SCHEDULE } from "#lib/constants/time.ts";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const registrationOpensLabel = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: BANGKOK_TIME_ZONE,
	}).format(new Date(EVENT_SCHEDULE.workshopRegistrationOpensAt));

	const remaining = $derived(Math.max(0, data.workshopLimit - data.advanceCount));
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
					เวิร์กช็อปที่ลงทะเบียนแล้ว ({data.advanceCount}/{data.workshopLimit})
					<img src={checkCircleIcon} alt="" />
				</p>
			</div>
			<Button variant="cta" size="cta-sm" href="/workshop">
				ดูทั้งหมด
				<img src={arrowRightIcon} alt="" />
			</Button>
		</div>

		{#if data.workshopRegistrationOpened}
			{#each data.workshops as workshop (workshop.id)}
				<WorkshopCard {workshop} />
			{/each}

			{#if remaining > 0 && !data.workshopRegistrationClosed}
				<Glass class="rounded-lg flex flex-col items-center gap-2 p-3">
					<p class="text-center text-xs text-brand-mist">คุณลงทะเบียนได้อีก {remaining} เวิร์กช็อป</p>
					<Button variant="cta" size="cta-sm" href="/workshop">ลงทะเบียนเพิ่ม</Button>
				</Glass>
			{/if}
		{:else}
			<!-- Placeholder until workshop registration opens (like the reward hunt's). -->
			<Glass class="rounded-lg p-3">
				<p class="text-center font-heading text-base font-medium text-brand-yellow">
					เตรียมพบกับการลงทะเบียนเวิร์กช็อป<br />Coming Soon!!
				</p>
				<p class="mt-2 text-center text-sm text-brand-mist">
					เปิดลงทะเบียน <time datetime={EVENT_SCHEDULE.workshopRegistrationOpensAt}>{registrationOpensLabel} น.</time>
				</p>
			</Glass>
		{/if}
	</section>

	<section class="flex w-full flex-col gap-2">
		<div class="text-brand-navy">
			<h2 class="text-2xl font-medium">ภารกิจล่าของรางวัล</h2>
			<p class="text-xs">*เมื่อเลื่อนขั้นแล้วจะไม่สามารถแลกของรางวัลขั้นที่ต่ำกว่าได้</p>
		</div>
		<!-- Placeholder until the reward hunt opens (RewardTierCard shows the tiers then). -->
		<Glass class="rounded-lg p-3">
			<p class="text-center font-heading text-base font-medium text-brand-yellow">
				เตรียมพบกับกิจกรรมแลกของรางวัลสุดพิเศษ<br />Coming Soon!!
			</p>
		</Glass>
	</section>
</main>
