<script lang="ts">
	import SignBoard from "#lib/components/sign-board.svelte";
	import WorkshopListCard from "#lib/components/workshop-list-card.svelte";
	import { listWorkshops } from "#lib/features/workshops/workshops.remote.ts";
	import { toWorkshop } from "#lib/workshops.ts";

	const workshops = listWorkshops();
</script>

<svelte:head>
	<title>Workshop | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-col items-center gap-6 px-3 pt-6 pb-4">
	<SignBoard title="WORKSHOP" wide />

	<section class="flex w-full flex-col gap-2">
		{#if workshops.error || workshops.current?.isErr()}
			<p class="text-status-red" role="alert">ไม่สามารถโหลดเวิร์กช็อปได้ กรุณาลองอีกครั้ง</p>
		{:else if workshops.current?.isOk()}
			{#each workshops.current.value as workshop (workshop.slug)}
				<WorkshopListCard workshop={toWorkshop({ ...workshop, timeSlots: workshop.timeslots })} />
			{:else}
				<p class="text-brand-mist">ยังไม่มีเวิร์กช็อป</p>
			{/each}
		{:else}
			<p class="text-brand-mist" role="status">กำลังโหลดเวิร์กช็อป...</p>
		{/if}
	</section>
</main>
