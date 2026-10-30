<script lang="ts">
	import { Button } from "#lib/components/ui/button/index.js";
	import Glass from "#lib/render/glass.svelte";

	// Placeholder until booth check-in is built: the staff menu already links here.
</script>

<svelte:head>
	<title>เช็คอินบูธนิทรรศการ | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">เช็คอินบูธนิทรรศการ</h1>
		<Glass class="w-full rounded-lg p-3">
			<p class="text-center font-heading text-base font-medium text-brand-yellow">
				หน้านี้กำลังพัฒนา<br />Coming Soon!!
			</p>
		</Glass>
	</div>

	<Button variant="cta" size="cta-lg" href="/staff" class="w-full">ย้อนกลับ</Button>
</main>
