<script lang="ts" module>
	export type PickerOption = {
		value: string;
		label: string;
		disabled?: boolean;
	};
</script>

<script lang="ts">
	import { Collapsible as CollapsiblePrimitive, RadioGroup as RadioGroupPrimitive } from "bits-ui";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import CircleIcon from "@lucide/svelte/icons/circle";
	import { cn } from "#lib/utils.js";

	type Props = {
		options: PickerOption[];
		value?: string;
		open?: boolean;
		placeholder?: string;
		id?: string;
		name?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		onValueChange?: (value: string) => void;
	};

	let {
		options,
		value = $bindable(""),
		open = $bindable(false),
		placeholder = "",
		id,
		name,
		required,
		disabled,
		class: className,
		onValueChange,
	}: Props = $props();

	let trigger = $state<HTMLButtonElement | null>(null);

	const selected = $derived(options.find((option) => option.value === value));

	function close() {
		open = false;
		trigger?.focus();
	}
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
		bind:ref={trigger}
		{id}
		data-slot="picker-trigger"
		class="group/picker-trigger flex w-full items-center gap-2 text-left outline-none disabled:cursor-not-allowed"
	>
		<span class={cn("min-w-0 flex-1 truncate", !selected && "text-brand-sky")}>
			{selected?.label ?? placeholder}
		</span>
		<ChevronDownIcon
			class="size-6 shrink-0 transition-transform group-data-[state=open]/picker-trigger:rotate-180"
		/>
	</CollapsiblePrimitive.Trigger>

	<CollapsiblePrimitive.Content data-slot="picker-content" class="flex flex-col gap-2">
		<div class="h-px w-full bg-brand-sky"></div>
		<RadioGroupPrimitive.Root
			bind:value
			{name}
			{required}
			{disabled}
			{onValueChange}
			class="flex flex-col gap-2"
		>
			{#each options as option (option.value)}
				<RadioGroupPrimitive.Item
					value={option.value}
					disabled={option.disabled}
					onclick={close}
					data-slot="picker-item"
					class="flex w-full items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-brand-navy/50 data-disabled:cursor-not-allowed data-disabled:opacity-50"
				>
					{#snippet children({ checked })}
						<span class="min-w-0 flex-1">{option.label}</span>
						<span class="grid size-6 shrink-0 place-items-center">
							<CircleIcon class="col-start-1 row-start-1 size-6" />
							{#if checked}
								<span class="col-start-1 row-start-1 size-2.5 rounded-full bg-current"></span>
							{/if}
						</span>
					{/snippet}
				</RadioGroupPrimitive.Item>
			{/each}
		</RadioGroupPrimitive.Root>
	</CollapsiblePrimitive.Content>
</CollapsiblePrimitive.Root>
