<script lang="ts" module>
	export type DetailRow = readonly [label: string, value: string];
</script>

<script lang="ts">
	/** Label/value rows, as in a scanner page's sheet. */
	let { rows }: { rows: readonly DetailRow[] } = $props();
</script>

<dl class="flex flex-col gap-0.5 text-lg">
	{#each rows as [label, value] (label)}
		<div class="flex gap-4">
			<dt class="w-20 shrink-0 text-brand-navy">{label}</dt>
			<dd class="min-w-0 flex-1 break-words text-black">{value}</dd>
		</div>
	{/each}
</dl>
