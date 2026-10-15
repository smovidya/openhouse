<script lang="ts">
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"border-transparent focus-visible:border-brand-navy focus-visible:ring-brand-navy/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive h-10 rounded-lg border bg-brand-mist px-3 py-1 text-base text-brand-navy transition-[color,box-shadow] file:h-8 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-brand-navy placeholder:text-brand-sky disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"border-transparent focus-visible:border-brand-navy focus-visible:ring-brand-navy/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive h-10 rounded-lg border bg-brand-mist px-3 py-1 text-base text-brand-navy transition-[color,box-shadow] file:h-8 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-brand-navy placeholder:text-brand-sky disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
