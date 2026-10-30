<script lang="ts">
	import { refreshAll } from "$app/navigation";
	import arrowRightIcon from "#lib/assets/icons/arrow-right-lg.svg";
	import GoogleSignIn from "#lib/components/google-sign-in.svelte";
	import StaffEnrollForm from "#lib/components/staff-enroll-form.svelte";
	import StaffInviteCodeForm from "#lib/components/staff-invite-code-form.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { getStaffActions } from "#lib/staff.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// A saved profile can be pending; only a valid invite grants staff access.
	const staff = $derived(data.session?.user.staff ?? null);
	const actions = $derived(getStaffActions(staff?.permission ?? []));
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
	{:else if !staff && !data.staffProfile}
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">ลงทะเบียนสตาฟ</h1>
		<p class="text-center text-sm text-brand-mist">
			กรอกข้อมูลเพื่อลงทะเบียน รหัสเชิญสามารถเพิ่มภายหลังได้
		</p>
		<StaffEnrollForm />
	{:else if !staff || staff.permission.length === 0}
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">ลงทะเบียนสตาฟแล้ว</h1>
		<p class="text-center text-sm text-brand-mist">
			บันทึกข้อมูลของคุณแล้ว กรอกรหัสเชิญที่ได้รับเพื่อเปิดใช้งานสิทธิ์สตาฟ
		</p>
		<StaffInviteCodeForm permissions={staff?.permission ?? []} />
	{:else}
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">
			เมนูสตาฟ
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
			<!-- Hidden until /staff/attendees exists.
			<Button variant="cta" size="cta-lg" href="/staff/attendees" class="w-full">
				ดูข้อมูลผู้เข้าร่วมงาน
				<img src={arrowRightIcon} alt="" />
			</Button>
			-->
			{#each actions as action (action.href)}
				<Button variant="cta" size="cta-lg" href={action.href} class="w-full">
					<img src={action.icon} alt="" />
					{action.label}
				</Button>
			{/each}
		</nav>

		<StaffInviteCodeForm permissions={staff.permission} />
	{/if}
</main>
