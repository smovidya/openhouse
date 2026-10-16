<script lang="ts">
	import signBoard from "#lib/assets/sign-board.svg";

	let { title }: { title: string } = $props();
</script>

<div class="relative h-[88px] w-[239px] shrink-0 overflow-clip">
	<div class="absolute inset-[5%_2.14%_3.33%_1.83%]">
		<div class="absolute inset-[-1.86%_-0.65%]">
			<img src={signBoard} alt="" class="block size-full max-w-none" />
		</div>
	</div>
	<h1
		class="absolute top-[calc(50%-27.08px)] left-1/2 -translate-x-1/2 text-[32px] font-medium whitespace-nowrap text-brand-mist text-shadow-[0px_4px_4px_var(--brand-brown)]"
	>
		{title}
	</h1>
</div>
