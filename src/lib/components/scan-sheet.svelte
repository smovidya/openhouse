<script lang="ts">
	import type { Snippet } from "svelte";
	import closeIcon from "#lib/assets/icons/close.svg";
	import * as Drawer from "#lib/components/ui/drawer/index.js";

	/** The bottom sheet a scanner page shows a scanned code in. Swipe down, ✕, the backdrop or Esc call `onclose`. */
	let { open, onclose, children }: { open: boolean; onclose: () => void; children: Snippet } = $props();
</script>

<Drawer.Root
	{open}
	shouldScaleBackground={false}
	onOpenChange={(open) => {
		if (!open) onclose();
	}}
>
	<Drawer.Content
		overlayClass="bg-black/40 supports-backdrop-filter:backdrop-blur-none"
		class="mx-auto h-[500px] max-w-[402px] bg-brand-mist px-2 pt-2 pb-6 data-[vaul-drawer-direction=bottom]:rounded-t-3xl data-[vaul-drawer-direction=bottom]:border-t-0"
	>
		<Drawer.Close
			class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/8 backdrop-blur-[4.583px]"
			aria-label="ปิด"
		>
			<img src={closeIcon} alt="" class="size-6" />
		</Drawer.Close>
		<!-- Clear of the close button, which sits in the corner over the drag handle's row. -->
		<div class="flex flex-1 flex-col pt-9">
			{@render children()}
		</div>
	</Drawer.Content>
</Drawer.Root>
