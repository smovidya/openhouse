<script lang="ts">
	import PrivacyPolicy from "#lib/registration/privacy-policy.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
</script>

<svelte:head>
	<title>นโยบายข้อมูลส่วนบุคคล | Science Chula Openhouse</title>
</svelte:head>

<!-- Same notice as the registration form's PDPA step, shown in full (see #lib/registration/privacy-policy.svelte). -->
<main class="mx-auto flex w-full max-w-[402px] flex-col items-center gap-6 px-3 pt-6 pb-4">
	<SignBoard title="PRIVACY" wide />

	<div class="w-full rounded-lg bg-brand-mist p-4">
		<PrivacyPolicy />
	</div>
</main>