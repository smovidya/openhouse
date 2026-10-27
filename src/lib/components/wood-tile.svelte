<script lang="ts">
	import nail from "#lib/assets/countdown/nail.svg";
	import nailShine from "#lib/assets/countdown/nail-shine.svg";

	let { value }: { value: string } = $props();

	// Nail + shine offsets from Figma, per corner.
	const nails = [
		{ nail: "left-[1.09px] top-[1.09px]", shine: "left-[2.19px] top-[2.19px]" },
		{ nail: "left-[54.69px] top-[1.09px]", shine: "left-[55.78px] top-[2.19px]" },
		{ nail: "left-[1.09px] top-[54.69px]", shine: "left-[2.19px] top-[55.78px]" },
		{ nail: "left-[54.69px] top-[54.69px]", shine: "left-[55.78px] top-[55.78px]" },
	];
	// Wood grain lines: [top, colour/opacity].
	const grain = [
		["top-[7.66px]", "bg-[#7a3e16] opacity-60"],
		["top-[8.75px]", "bg-[#9e5824] opacity-30"],
		["top-[20.78px]", "bg-[#7a3e16] opacity-60"],
		["top-[21.88px]", "bg-[#9e5824] opacity-30"],
		["top-[33.91px]", "bg-[#7a3e16] opacity-60"],
		["top-[35px]", "bg-[#9e5824] opacity-30"],
		["top-[47.03px]", "bg-[#7a3e16] opacity-60"],
		["top-[48.13px]", "bg-[#9e5824] opacity-30"],
	];
</script>

<!-- Fixed 70×70 illustration from Figma ("Timber" countdown tile); layers are absolutely placed. -->
<div
	class="relative h-17.5 w-full shrink-0 overflow-clip rounded-[10.938px] border-[3.281px] border-[#3d1f0a] bg-[#6b3a1f]"
>
	<div class="absolute top-[-3.28px] left-[-3.28px] size-17.5 rounded-[8.75px] bg-[#8b4a1c]"></div>
	{#each grain as [top, colour] (top)}
		<div class={["absolute left-[-3.28px] h-[1.094px] w-17.5", top, colour]}></div>
	{/each}
	<div class="absolute top-0 left-0 h-[3.281px] w-[63.438px] rounded-[3.281px] bg-[#c07a3a] opacity-70"></div>
	<div class="absolute top-0 left-0 h-[63.438px] w-[3.281px] rounded-[3.281px] bg-[#c07a3a] opacity-50"></div>
	<div class="absolute top-[60.16px] left-0 h-[3.281px] w-[63.438px] rounded-[3.281px] bg-[#3d1a08] opacity-60"></div>
	<div class="absolute top-0 left-[60.16px] h-[63.438px] w-[3.281px] rounded-[3.281px] bg-[#3d1a08] opacity-50"></div>
	<div class="absolute top-[7.66px] left-[5.47px] h-[3.281px] w-[52.5px] rounded-[2.188px] bg-[#2e1206] opacity-50"></div>
	<div class="absolute top-[7.66px] left-[5.47px] h-[48.125px] w-[3.281px] rounded-[2.188px] bg-[#2e1206] opacity-40"></div>
	<div class="absolute top-[9.84px] left-[7.66px] h-[43.75px] w-[48.125px] rounded-[4.375px] bg-[#5a2a0e]"></div>
	<div class="absolute top-[51.41px] left-[7.66px] h-[2.188px] w-[48.125px] rounded-[2.188px] bg-[#a05c25] opacity-50"></div>
	<div class="absolute top-[9.84px] left-[53.59px] h-[43.75px] w-[2.188px] rounded-[2.188px] bg-[#a05c25] opacity-40"></div>
	{#each nails as corner (corner.nail)}
		<img src={nail} alt="" class={["absolute", corner.nail]} />
		<img src={nailShine} alt="" class={["absolute", corner.shine]} />
	{/each}
	<span
		class="absolute top-[calc(50%-0.47px)] left-[calc(50%-0.5px)] -translate-1/2 font-heading text-[30.625px] leading-[43.75px] font-medium whitespace-nowrap text-brand-mist text-shadow-[0px_4px_4px_rgb(0_0_0/0.25)] tabular-nums"
	>
		{value}
	</span>
</div>
