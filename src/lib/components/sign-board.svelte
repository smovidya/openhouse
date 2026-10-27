<script lang="ts">
	import signBoard from "#lib/assets/sign-board.svg";
	import signBoardWide from "#lib/assets/sign-board-wide.svg";
	import { cn } from "#lib/utils.js";

	/** `wide` fits longer titles such as "MY QR CODE". */
	let { title, wide = false }: { title: string; wide?: boolean } = $props();
</script>

<div
	class={cn(
		"relative h-[88px] shrink-0 overflow-clip",
		wide ? "w-[300px]" : "w-[239px]",
	)}
>
	<div class="absolute inset-[5%_2.14%_3.33%_1.83%]">
		<div
			class={cn(
				"absolute",
				wide ? "inset-[-1.86%_-0.52%]" : "inset-[-1.86%_-0.65%]",
			)}
		>
			<img
				src={wide ? signBoardWide : signBoard}
				alt=""
				class="block size-full max-w-none"
			/>
		</div>
	</div>
	<h1
		class="absolute top-[calc(50%-25px)] left-1/2 -translate-x-1/2 text-[32px] font-medium whitespace-nowrap text-brand-mist text-shadow-[0_3px_4px_rgb(61_31_10/0.6),0_6px_6px_color-mix(in_srgb,var(--brand-brown)_50%,transparent)] [-webkit-text-stroke:4px_var(--brand-brown)] [paint-order:stroke_fill]"
	>
		{title}
	</h1>
</div>
