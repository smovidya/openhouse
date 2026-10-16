<script lang="ts">
	import { Checkbox as CheckboxPrimitive, Collapsible as CollapsiblePrimitive } from "bits-ui";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import SquareIcon from "@lucide/svelte/icons/square";
	import SquareCheckIcon from "@lucide/svelte/icons/square-check";
	import { cn } from "#lib/utils.js";
	import type { PickerOption } from "./picker.svelte";

	type Props = {
		options: PickerOption[];
		value?: string[];
		open?: boolean;
		/** Shown when nothing is selected. Rendered like a value, since "none" is a valid answer. */
		placeholder?: string;
		id?: string;
		name?: string;
		disabled?: boolean;
		class?: string;
		onValueChange?: (value: string[]) => void;
	};

	let {
		options,
		value = $bindable([]),
		open = $bindable(false),
		placeholder = "",
		id,
		name,
		disabled,
		class: className,
		onValueChange,
	}: Props = $props();

	const summary = $derived(
		options
			.filter((option) => value.includes(option.value))
			.map((option) => option.label)
			.join(", ")
	);
</script>

<CollapsiblePrimitive.Root
	bind:open
	{disabled}
	data-slot="picker"
	class={cn(
		"flex w-full flex-col gap-2 rounded-lg border border-transparent bg-brand-mist py-2 pr-2 pl-3 text-base text-brand-navy transition-[color,box-shadow] has-[[data-slot=picker-trigger]:focus-visible]:border-brand-navy has-[[data-slot=picker-trigger]:focus-visible]:ring-3 has-[[data-slot=picker-trigger]:focus-visible]:ring-brand-navy/50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
		className
	)}
>
	<CollapsiblePrimitive.Trigger
		{id}
		data-slot="picker-trigger"
		class="group/picker-trigger flex w-full items-center gap-2 text-left outline-none disabled:cursor-not-allowed"
	>
		<span class="min-w-0 flex-1 truncate">{summary || placeholder}</span>
		<ChevronDownIcon
			class="size-6 shrink-0 transition-transform group-data-[state=open]/picker-trigger:rotate-180"
		/>
	</CollapsiblePrimitive.Trigger>

	<CollapsiblePrimitive.Content data-slot="picker-content" class="flex flex-col gap-2">
		<div class="h-px w-full bg-brand-sky"></div>
		<CheckboxPrimitive.Group
			bind:value
			{name}
			{disabled}
			{onValueChange}
			class="flex flex-col gap-2"
		>
			{#each options as option (option.value)}
				<CheckboxPrimitive.Root
					value={option.value}
					disabled={option.disabled}
					data-slot="picker-item"
					class="flex w-full items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-brand-navy/50 data-disabled:cursor-not-allowed data-disabled:opacity-50"
				>
					{#snippet children({ checked })}
						<span class="min-w-0 flex-1">{option.label}</span>
						{#if checked}
							<SquareCheckIcon class="size-6 shrink-0" />
						{:else}
							<SquareIcon class="size-6 shrink-0" />
						{/if}
					{/snippet}
				</CheckboxPrimitive.Root>
			{/each}
		</CheckboxPrimitive.Group>
	</CollapsiblePrimitive.Content>
</CollapsiblePrimitive.Root>
