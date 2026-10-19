<script lang="ts">
	import Glass from "#lib/render/glass.svelte";
	import { WORKSHOP_REGISTRATION_RULES } from "#lib/constants/workshops.ts";
</script>

<Glass as="section" class="w-full rounded-lg p-3 text-xs text-brand-mist">
	<details>
		<summary class="cursor-pointer text-sm text-brand-yellow">เงื่อนไขการลงทะเบียนและเช็กอิน Workshop</summary>
		<ol class="mt-3 list-decimal space-y-2 pl-5">
			{#each WORKSHOP_REGISTRATION_RULES as rule (rule)}
				<li>{rule}</li>
			{/each}
		</ol>
	</details>
</Glass>
