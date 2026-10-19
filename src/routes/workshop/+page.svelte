<script lang="ts">
	import SignBoard from "#lib/components/sign-board.svelte";
	import WorkshopListCard from "#lib/components/workshop-list-card.svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Workshop | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-col items-center gap-6 px-3 pt-6 pb-4">
	<SignBoard title="WORKSHOP" wide />

	<section class="flex w-full flex-col gap-2">
		{#each data.workshops as workshop (workshop.id)}
			<WorkshopListCard {workshop} registered={data.registered.includes(workshop.id)} />
		{/each}
	</section>
</main>
