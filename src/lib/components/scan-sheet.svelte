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
			all the way to them. pt-9 clears the close button, which sits over the drag handle's row.
		-->
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-9 pb-6">
			{@render children()}
		</div>
	</Drawer.Content>
</Drawer.Root>
