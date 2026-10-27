<script lang="ts">
	import { page } from "$app/state";
	import Glass from "#lib/render/glass.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import { Button } from "#lib/components/ui/button/index.js";

	const COPY: Record<number, { title: string; body: string }> = {
		403: {
			title: "ไม่มีสิทธิ์เข้าถึงหน้านี้",
			body: "หน้านี้สงวนไว้สำหรับลูกเรือบางกลุ่มเท่านั้น หากคิดว่าเป็นความผิดพลาด ลองออกจากระบบแล้วเข้าใหม่ด้วยบัญชีที่ถูกต้อง",
		},
		404: {
			title: "ไม่พบหน้านี้",
			body: "ดูเหมือนว่าเกาะนี้จะไม่มีอยู่บนแผนที่ ลองกลับไปตั้งหลักที่ท่าเรือแล้วออกเดินทางใหม่อีกครั้ง",
		},
	};
	const copy = $derived(
		COPY[page.status] ?? {
			title: "เกิดข้อผิดพลาด",
			body: "เรือของเราเจอพายุเล็กน้อย ลองใหม่อีกครั้งในภายหลัง",
		}
	);
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
			{copy.title}
		</h2>
		{#if detail}
			<p class="text-sm text-brand-yellow">{detail}</p>
		{/if}
		<p class="text-sm text-brand-mist">{copy.body}</p>
	</Glass>

	<Button variant="cta" size="cta-lg" href="/" class="w-full">กลับหน้าแรก</Button>
</main>
