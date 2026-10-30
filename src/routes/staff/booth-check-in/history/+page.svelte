<script lang="ts">
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	// A booth's check-in history (Figma "บูธนิทรรศการ / ประวัติการเช็คอิน").
	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>ประวัติการเช็คอิน | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">บูธนิทรรศการ</h1>

		<section class="flex flex-col gap-4">
			<h2 class="text-2xl text-brand-sky">ประวัติการเช็คอิน</h2>
			{#each data.checkins as checkin (checkin.id)}
				<article class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-base text-brand-mist">
					<div>
						<p>{checkin.name}</p>
						<p>{checkin.age} ปี / {checkin.level}</p>
						<p>{checkin.booth}</p>
					</div>
					<p class="self-center text-right text-sm whitespace-nowrap">เวลา {checkin.time}</p>
				</article>
			{:else}
				<p class="text-center text-base text-brand-mist">ยังไม่พร้อมใช้งาน</p>
			{/each}
		</section>
	</div>

	<Button variant="cta" size="cta-lg" href="/staff/booth-check-in" class="w-full">ย้อนกลับ</Button>
</main>
