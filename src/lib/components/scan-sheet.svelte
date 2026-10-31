<script lang="ts">
	import type { Snippet } from "svelte";
	import closeIcon from "#lib/assets/icons/close.svg";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { cn } from "#lib/utils.js";

	/** The bottom sheet a scanner page shows a scanned code in. Swipe down, ✕, the backdrop or Esc call `onclose`. */
	let {
		open,
		onclose,
		children,
		class: className,
	}: { open: boolean; onclose: () => void; children: Snippet; class?: string } = $props();

	/** Whether the content runs past the bottom of the sheet: a fade and a hint say so. */
	let more = $state(false);

	function trackOverflow(scroller: HTMLElement) {
		const update = () => {
			more = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 4;
		};
		const observer = new ResizeObserver(update);
		observer.observe(scroller);
		// The content changes size too (a sheet's contents arrive after it opens).
		for (const child of scroller.children) observer.observe(child);
		scroller.addEventListener("scroll", update, { passive: true });
		update();
		return () => {
			observer.disconnect();
			scroller.removeEventListener("scroll", update);
		};
	}
</script>

<!--
	Controlled through a function binding: the drawer closes itself (swipe, ✕, backdrop, Esc) by
	writing false, which goes to `onclose`; it never keeps a value of its own. A plain `open={...}`
	let a swipe-closed drawer drift from the page's state, so it stayed hidden when reopened.
-->
<Drawer.Root
	bind:open={
		() => open,
		(value) => {
			if (!value) onclose();
		}
	}
	shouldScaleBackground={false}
>
	<Drawer.Content
		overlayClass="bg-black/40 supports-backdrop-filter:backdrop-blur-none"
		class={cn(
			"mx-auto h-[500px] max-w-[402px] bg-brand-mist data-[vaul-drawer-direction=bottom]:rounded-t-3xl data-[vaul-drawer-direction=bottom]:border-t-0",
			className
		)}
	>
		<Drawer.Close
			class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/8 backdrop-blur-[4.583px]"
			aria-label="ปิด"
		>
			<img src={closeIcon} alt="" class="size-6" />
		</Drawer.Close>
		<!--
			The scroll container reaches the sheet's edges; its padding is inside, so content scrolls
			all the way to them. The title (centred) shares its first row with the close button.
		-->
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-1 pb-6" {@attach trackOverflow}>
			<div class="flex flex-1 flex-col">
				{@render children()}
			</div>
		</div>
		{#if more}
			<!-- Over the bottom edge while there's more to scroll to. -->
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-linear-to-t from-brand-mist to-transparent pb-2"
			>
				<span class="rounded-full bg-brand-navy px-3 py-1 text-xs text-brand-mist shadow">เลื่อนดูเพิ่มเติม ↓</span>
			</div>
		{/if}
	</Drawer.Content>
</Drawer.Root>
