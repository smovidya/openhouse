<script lang="ts" module>
	// Adapted from rpkm2026-frontend's CameraTroubleshootDialog (its Thai copy).
	const sections = [
		{
			title: "Chrome / Edge (Android)",
			steps: [
				"แตะไอคอนแม่กุญแจหรือไอคอนตั้งค่าข้างช่องที่อยู่เว็บ",
				"เลือก สิทธิ์ (Permissions)",
				"เปิดสิทธิ์ กล้อง (Camera)",
				"รีเฟรชหน้านี้อีกครั้ง",
			],
			note: "",
		},
		{
			title: "Safari (iPhone / iPad)",
			steps: [
				"แตะปุ่ม “AA” หรือไอคอนตั้งค่าในแถบที่อยู่เว็บ",
				"เลือก การตั้งค่าเว็บไซต์ (Website Settings)",
				"ตั้งค่า กล้อง เป็น อนุญาต (Allow)",
				"โหลดหน้านี้ใหม่",
			],
			note: "หรือไปที่ ตั้งค่า > Safari > กล้อง แล้วเลือก อนุญาต",
		},
	];
	const otherTips = [
		"ปิดแอปหรือแท็บอื่นที่กำลังใช้กล้องอยู่ แล้วลองใหม่",
		"รีเฟรชหน้านี้อีกครั้ง",
		"หากยังไม่ได้ ลองเปลี่ยนเบราว์เซอร์หรืออุปกรณ์อื่น",
	];
</script>

<script lang="ts">
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { cn } from "#lib/utils.js";

	/** An underlined "how to fix camera problems" link and the instructions it opens. */
	let { class: className }: { class?: string } = $props();

	let open = $state(false);
</script>

<button
	type="button"
	class={cn("cursor-pointer text-sm text-brand-mist underline underline-offset-4", className)}
	onclick={() => (open = true)}
>
	วิธีแก้ปัญหากล้อง
</button>

<!-- Swipe down (or the backdrop, Esc) to dismiss. -->
<Drawer.Root bind:open shouldScaleBackground={false}>
	<Drawer.Content
		overlayClass="bg-black/40 supports-backdrop-filter:backdrop-blur-none"
		class="mx-auto max-w-[402px] bg-brand-mist text-brand-navy data-[vaul-drawer-direction=bottom]:rounded-t-3xl data-[vaul-drawer-direction=bottom]:border-t-0"
	>
		<!-- Scrolls inside the drawer (max 80vh) so long instructions stay reachable. -->
		<div class="flex flex-col gap-4 overflow-y-auto p-6">
			<Drawer.Title class="font-heading text-xl font-medium text-black">วิธีแก้ปัญหากล้อง</Drawer.Title>
			<Drawer.Description class="text-sm text-brand-navy">
				หากกล้องไม่ทำงานหรือหน้าจอเป็นสีดำ ให้ลองทำตามขั้นตอนตามเบราว์เซอร์ที่ใช้งาน
			</Drawer.Description>
			{#each sections as section (section.title)}
				<section class="flex flex-col gap-1">
					<h3 class="font-heading font-medium text-black">{section.title}</h3>
					<ol class="list-decimal ps-5 text-sm">
						{#each section.steps as step (step)}
							<li>{step}</li>
						{/each}
					</ol>
					{#if section.note}
						<p class="text-sm">{section.note}</p>
					{/if}
				</section>
			{/each}
			<section class="flex flex-col gap-1">
				<h3 class="font-heading font-medium text-black">วิธีอื่น ๆ</h3>
				<ul class="list-disc ps-5 text-sm">
					{#each otherTips as tip (tip)}
						<li>{tip}</li>
					{/each}
				</ul>
			</section>
		</div>
	</Drawer.Content>
</Drawer.Root>
