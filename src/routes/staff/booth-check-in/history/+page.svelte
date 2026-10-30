<script lang="ts">
	import HistoryList from "#lib/components/history-list.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	// A booth's check-in history (Figma "บูธนิทรรศการ / ประวัติการเช็คอิน"): the latest 100.
	let { data }: PageProps = $props();

	const entries = $derived(
		data.checkins.map((checkin) => ({
			...checkin,
			detail: checkin.checkpointName ?? checkin.checkpointId,
			at: checkin.createdAt,
		}))
	);
	const backHref = $derived(
		data.checkpointId
			? `/staff/booth-check-in?checkpoint=${encodeURIComponent(data.checkpointId)}`
			: "/staff/booth-check-in"
	);
</script>

<svelte:head>
	<title>ประวัติการเช็คอิน | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">บูธนิทรรศการ</h1>

		<section class="flex flex-col gap-4">
			<h2 class="text-2xl text-brand-sky">ประวัติการเช็คอิน</h2>
			<HistoryList {entries} empty="ยังไม่มีผู้เช็คอิน" />
		</section>
	</div>

	<Button variant="cta" size="cta-lg" href={backHref} class="w-full">ย้อนกลับ</Button>
</main>
