<script lang="ts">
	import errorIcon from "#lib/assets/icons/cancel-red.svg";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Dialog from "#lib/components/ui/dialog/index.js";
	import { errorDialog } from "#lib/error-dialog.svelte.js";

	// Renders showError(); mounted once in the root layout. ตกลง, the backdrop or Esc dismiss it.
	const error = $derived(errorDialog.current);
</script>

<Dialog.Root
	open={error !== null}
	onOpenChange={(open) => {
		if (!open) error?.close();
	}}
>
	<Dialog.Content showCloseButton={false} class="max-w-[340px] items-center gap-4 bg-brand-mist text-center">
		{#if error}
			<img src={errorIcon} alt="" class="mx-auto size-12" />
			<Dialog.Header class="items-center">
				<Dialog.Title class="font-heading text-xl font-medium text-black">{error.title}</Dialog.Title>
				<Dialog.Description class="text-base text-brand-navy">{error.description}</Dialog.Description>
			</Dialog.Header>
			<Button variant="cta" size="cta-lg" class="w-full" onclick={error.close}>ตกลง</Button>
		{/if}
	</Dialog.Content>
</Dialog.Root>
