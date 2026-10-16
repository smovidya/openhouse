<script lang="ts">
	import { IsMounted } from "runed";
	import arrowRightIcon from "#lib/assets/icons/arrow-right-lg.svg";
	import { Button } from "#lib/components/ui/button/index.js";
	import { fakeStaffRole } from "#lib/dev-settings.svelte.js";
	import { staffMenus } from "#lib/staff.js";

	// TODO: take the role from the session once auth exists.
	// The fake role lives in localStorage, so SSR always renders the default; switching only after
	// mount avoids a hydration mismatch (hydration doesn't repair <img src>).
	const mounted = new IsMounted();
	const menu = $derived(
		(mounted.current && staffMenus[fakeStaffRole.current]) || staffMenus.central
	);
</script>

<svelte:head>
	<title>เมนูสตาฟ | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-center gap-6 p-3">
	<h1 class="text-center text-[32px] font-medium text-brand-yellow">
		เมนูสตาฟ <em>{menu.title}</em>
	</h1>

	<nav class="flex w-full flex-col gap-3">
		<Button variant="cta" size="cta-lg" href="/staff/attendees" class="w-full">
			ดูข้อมูลผู้เข้าร่วมงาน
			<img src={arrowRightIcon} alt="" />
		</Button>
		{#each menu.actions as action (action.href)}
			<Button variant="cta" size="cta-lg" href={action.href} class="w-full">
				<img src={action.icon} alt="" />
				{action.label}
			</Button>
		{/each}
	</nav>
</main>
