<script lang="ts">
	import { IsMounted } from "runed";
	import { refreshAll } from "$app/navigation";
	import arrowRightIcon from "#lib/assets/icons/arrow-right-lg.svg";
	import GoogleSignIn from "#lib/components/google-sign-in.svelte";
	import StaffEnrollForm from "#lib/components/staff-enroll-form.svelte";
	import StaffInviteCodeForm from "#lib/components/staff-invite-code-form.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { fakeStaffRole } from "#lib/dev-settings.svelte.js";
	import { staffMenus } from "#lib/staff.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// The staff entry point: sign in, then enroll with an invite code, then the menu (where more
	// codes add permissions). Pages under /staff are staff only (+layout.ts).
	const staff = $derived(data.session?.user.staff ?? null);

	// TODO: take the role from the session once auth exists.
	// The fake role lives in localStorage, so SSR always renders the default; switching only after
	// mount avoids a hydration mismatch (hydration doesn't repair <img src>).
	const mounted = new IsMounted();
	const menu = $derived(
		(mounted.current && staffMenus[fakeStaffRole.current]) || staffMenus.central
	);
</script>

<svelte:head>
	<title>{staff ? "เมนูสตาฟ" : "สตาฟ"} | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-center gap-6 p-3">
	{#if !data.session}
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">สำหรับสตาฟ</h1>
		<p class="text-center text-sm text-brand-mist">เข้าสู่ระบบด้วยบัญชี Google เพื่อลงทะเบียนสตาฟ</p>
		<!-- Signing in reloads the layout data: the page then shows the enrollment form. -->
		<GoogleSignIn onSignedIn={refreshAll} />
	{:else if data.session.user.attendee && !staff}
		<!-- Staff and attendees are mutually exclusive: an attendee account can't enroll. -->
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">สำหรับสตาฟ</h1>
		<p class="text-center text-sm text-brand-mist">
			บัญชีนี้ลงทะเบียนเป็นผู้เข้าร่วมงานแล้ว จึงลงทะเบียนเป็นสตาฟไม่ได้
			หากเป็นสตาฟ กรุณาออกจากระบบแล้วเข้าสู่ระบบด้วยบัญชี Google อื่น
		</p>
		<Button variant="cta" size="cta-lg" href="/myid" class="w-full">ไปที่ MY QR CODE</Button>
	{:else if !staff}
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">ลงทะเบียนสตาฟ</h1>
		<p class="text-center text-sm text-brand-mist">
			กรอกข้อมูลและรหัสเชิญที่ได้รับ สิทธิ์ของคุณจะเป็นไปตามรหัสเชิญ
		</p>
		<StaffEnrollForm />
	{:else}
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">
			เมนูสตาฟ <em>{menu.title}</em>
		</h1>

		<nav class="flex w-full flex-col gap-3">
			{#if staff.permission.includes("admin")}
				<Button variant="cta" size="cta-lg" href="/staff/dashboard" class="w-full">
					แดชบอร์ดแอดมิน
					<img src={arrowRightIcon} alt="" />
				</Button>
				<Button variant="cta" size="cta-lg" href="/staff/invites" class="w-full">
					จัดการรหัสเชิญ
					<img src={arrowRightIcon} alt="" />
				</Button>
			{/if}
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

		<StaffInviteCodeForm permissions={staff.permission} />
	{/if}
</main>
