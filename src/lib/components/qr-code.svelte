<script lang="ts">
	import QRCode from "qrcode";
	import { cn } from "#lib/utils.js";

	let { value, class: className }: { value: string; class?: string } = $props();

	// Markup comes from the qrcode library (paths only), never from user HTML.
	const svg = $derived(
		QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M" })
	);
</script>

<div
	role="img"
	aria-label="QR code: {value}"
	class={cn("bg-white [&>svg]:block [&>svg]:size-full", className)}
>
	{#await svg then markup}
		{@html markup}
	{/await}
</div>
