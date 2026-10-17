<script lang="ts">
	import { page } from "$app/state";
	import Glass from "#lib/components/glass.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import { Button } from "#lib/components/ui/button/index.js";

	const notFound = $derived(page.status === 404);
	// SvelteKit's default messages ("Not Found", "Internal Error") are English; only show ours.
	const detail = $derived(
		page.error?.message && !["Not Found", "Internal Error"].includes(page.error.message)
			? page.error.message
			: undefined
	);
</script>

<svelte:head>
	<title>{page.status} | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-center gap-6 px-3 pt-6 pb-4">
	<SignBoard title={String(page.status)} />

	<Glass as="section" class="flex w-full flex-col gap-2 rounded-xl p-4 text-center">
		<h2 class="text-2xl font-medium text-brand-yellow">
			{notFound ? "ไม่พบหน้านี้" : "เกิดข้อผิดพลาด"}
		</h2>
		{#if detail}
			<p class="text-sm text-brand-yellow">{detail}</p>
		{/if}
		<p class="text-sm text-brand-mist">
			{notFound
				? "ดูเหมือนว่าเกาะนี้จะไม่มีอยู่บนแผนที่ ลองกลับไปตั้งหลักที่ท่าเรือแล้วออกเดินทางใหม่อีกครั้ง"
				: "เรือของเราเจอพายุเล็กน้อย ลองใหม่อีกครั้งในภายหลัง"}
		</p>
	</Glass>

	<Button variant="cta" size="cta-lg" href="/" class="w-full">กลับหน้าแรก</Button>
</main>
