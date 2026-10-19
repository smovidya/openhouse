<script lang="ts">
	import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
	import checkCircleIcon from "#lib/assets/icons/check-circle.svg";
	import Glass from "#lib/components/glass.svelte";
	import QrCode from "#lib/components/qr-code.svelte";
	import RewardTierCard from "#lib/components/reward-tier-card.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import WorkshopCard from "#lib/components/workshop-card.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { getMyWorkshopRegistrations } from "#lib/features/workshops/workshops.remote.ts";
	import { MAX_ADVANCE_WORKSHOP_REGISTRATIONS } from "#lib/constants/workshops.ts";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const registrations = getMyWorkshopRegistrations();
	const workshops = $derived(registrations.current?.isOk() ? registrations.current.value : []);
	const advanceCount = $derived(workshops.filter((workshop) => workshop.type === "advance").length);
	const remaining = $derived(Math.max(0, MAX_ADVANCE_WORKSHOP_REGISTRATIONS - advanceCount));
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
					เวิร์กช็อปที่ลงทะเบียนล่วงหน้า ({advanceCount}/{MAX_ADVANCE_WORKSHOP_REGISTRATIONS})
					<img src={checkCircleIcon} alt="" />
				</p>
			</div>
			<Button variant="cta" size="cta-sm" href="/workshop">
				ดูทั้งหมด
				<img src={arrowRightIcon} alt="" />
			</Button>
		</div>

		{#if registrations.error || registrations.current?.isErr()}
			<p role="alert" class="text-status-red">ไม่สามารถโหลดการลงทะเบียนได้ กรุณาโหลดหน้าใหม่</p>
		{:else if !registrations.current}
			<p role="status" class="text-brand-navy">กำลังโหลดการลงทะเบียน...</p>
		{:else}
			{#each workshops as workshop (workshop.id)}
				<a href={`/workshop/${workshop.workshopSlug}`} class="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-brand-navy" aria-label={`${workshop.workshopTitle} รอบ ${workshop.workshopRoundNumber} ดูรายละเอียดหรือยกเลิก`}>
					<WorkshopCard workshop={{
						id: workshop.id,
						title: `${workshop.workshopTitle} — รอบ ${workshop.workshopRoundNumber}`,
						department: `${workshop.department} (${workshop.departmentAbbr})`,
						description: workshop.description,
						start: workshop.startsAt.toISOString(),
						end: workshop.endsAt.toISOString(),
					}} />
				</a>
			{:else}
				<p class="text-sm text-brand-navy">ยังไม่ได้ลงทะเบียนเวิร์กช็อป</p>
			{/each}
		{/if}

		{#if registrations.current?.isOk() && remaining > 0}
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
