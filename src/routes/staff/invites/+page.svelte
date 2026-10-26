<script lang="ts">
	import { refreshAll } from "$app/navigation";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Label } from "#lib/components/ui/label/index.js";
	import { MultiPicker } from "#lib/components/ui/picker/index.js";
	import type { StaffPermission } from "#lib/features/staff/permissions.ts";
	import { createInviteCode, disableInviteCode } from "#lib/features/staff/staff.remote.ts";
	import Glass from "#lib/render/glass.svelte";
	import { httpStatus } from "#lib/utils.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
	let permissions = $state<StaffPermission[]>([]);
	let selectedBooths = $state<string[]>([]);
	let customCode = $state("");
	let created = $state<Awaited<ReturnType<typeof createInviteCode>> | null>(null);
	let busy = $state(false);
	let message = $state("");
	let failure = $state("");
	let copyMessage = $state("");
	let refreshFailed = $state(false);

	const basePermissions: { value: StaffPermission; label: string }[] = [
		{ value: "workshopStaff", label: "เวิร์คช็อป" },
		{ value: "boothStaff:all", label: "ทุกบูธภาควิชา" },
		{ value: "activityStaff", label: "ส่วนกลาง (รวมบูธและเวิร์คช็อป)" },
		{ value: "admin", label: "ผู้ดูแลระบบ (Admin) — ทุกสิทธิ์" },
	];
	const options = $derived([
		...basePermissions,
		...data.boothScopes,
	]);
	const selectedPermissions = $derived([
		...permissions,
		...data.boothScopes.filter((scope) => selectedBooths.includes(scope.value)).map((scope) => scope.value),
	]);
	const dateFormat = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Bangkok",
	});

	function errorMessage(cause: unknown) {
		const status = httpStatus(cause);
		if (status === 401) return "กรุณาเข้าสู่ระบบอีกครั้ง";
		if (status === 403) return "เฉพาะผู้ดูแลระบบเท่านั้น";
		if (status === 400) return "ตรวจสอบสิทธิ์และรหัสเชิญ รหัสต้องมี 8–128 ตัวอักษร";
		if (status === 409) return "รหัสเชิญนี้ถูกใช้แล้ว กรุณาเลือกรหัสใหม่";
		return "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง";
	}

	async function refreshList() {
		try {
			await refreshAll();
			refreshFailed = false;
		} catch {
			refreshFailed = true;
		}
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (busy || created || selectedPermissions.length === 0) return;
		busy = true;
		failure = "";
		message = "";
		copyMessage = "";
		try {
			created = await createInviteCode({ permission: selectedPermissions, code: customCode });
			permissions = [];
			selectedBooths = [];
			customCode = "";
			message = "สร้างรหัสเชิญแล้ว";
			await refreshList();
		} catch (cause) {
			failure = errorMessage(cause);
		} finally {
			busy = false;
		}
	}

	async function copyCode() {
		if (!created) return;
		try {
			await navigator.clipboard.writeText(created.code);
			copyMessage = "คัดลอกรหัสแล้ว";
		} catch {
			copyMessage = "คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกรหัสแล้วคัดลอกเอง";
		}
	}

	async function disable(id: string) {
		if (busy) return;
		busy = true;
		failure = "";
		message = "";
		try {
			await disableInviteCode({ id });
			if (created?.id === id) created = null;
			message = "ปิดใช้งานรหัสเชิญแล้ว";
			await refreshList();
		} catch (cause) {
			failure = errorMessage(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>จัดการรหัสเชิญ | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-3 py-6 text-brand-mist">
	<header class="flex flex-col gap-2">
		<a href="/staff" class="w-fit text-sm underline">กลับเมนูสตาฟ</a>
		<h1 class="text-[32px] font-medium text-brand-yellow">จัดการรหัสเชิญ</h1>
		<p class="text-sm">สร้างรหัสสำหรับสตาฟหรือผู้ดูแลระบบ รหัสแต่ละชุดใช้ได้หลายคน</p>
	</header>

	<Glass as="section" class="flex flex-col gap-4 rounded-xl p-4">
		<h2 class="text-xl text-brand-yellow">สร้างรหัสเชิญ</h2>
		<form onsubmit={create} class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Label for="custom-invite-code">รหัสเชิญที่กำหนดเอง (ไม่บังคับ)</Label>
				<Input
					id="custom-invite-code"
					bind:value={customCode}
					placeholder="เช่น TCAS-TEAM-2026"
					minlength={8}
					maxlength={128}
					autocomplete="off"
					autocapitalize="off"
					spellcheck={false}
					disabled={busy || created !== null}
					aria-describedby="custom-invite-help"
					class="focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60"
				/>
				<p id="custom-invite-help" class="text-xs">เว้นว่างเพื่อสุ่มรหัส หรือกำหนดเอง 8–128 ตัวอักษร ตัวพิมพ์เล็กและใหญ่ต่างกัน</p>
			</div>
			<fieldset disabled={busy || created !== null} class="flex flex-col gap-3 disabled:opacity-60">
				<legend class="mb-3 text-sm">เลือกสิทธิ์ที่จะให้ (เลือกได้หลายข้อ)</legend>
				{#each basePermissions as option (option.value)}
					<label class="flex items-start gap-3 text-sm">
						<input type="checkbox" bind:group={permissions} value={option.value} class="mt-0.5 size-4 shrink-0 accent-brand-yellow" />
						<span>{option.label}</span>
					</label>
				{/each}
			</fieldset>
			<div class="flex flex-col gap-2">
				<Label for="invite-booth-scopes">เลือกบูธที่ดูแล</Label>
				<MultiPicker
					id="invite-booth-scopes"
					options={data.boothScopes}
					bind:value={selectedBooths}
					placeholder="เลือกภาควิชา, TCAS หรือกิจกรรมส่วนกลาง"
					disabled={busy || created !== null}
					class="has-[[data-slot=picker-trigger]:focus-visible]:border-brand-yellow has-[[data-slot=picker-trigger]:focus-visible]:ring-brand-yellow/60"
				/>
				<p class="text-xs">เลือกได้หลายบูธ สิทธิ์ทุกบูธภาควิชาไม่รวม TCAS และกิจกรรมส่วนกลาง</p>
			</div>
			<Button type="submit" variant="cta" size="cta-sm" disabled={busy || created !== null || selectedPermissions.length === 0}>
				สร้างรหัสเชิญ
			</Button>
		</form>
	</Glass>

	{#if created}
		<Glass as="section" class="flex flex-col gap-3 rounded-xl border border-brand-yellow/50 p-4" aria-label="รหัสเชิญใหม่">
			<Label for="new-invite-code" class="text-lg text-brand-yellow">รหัสเชิญใหม่</Label>
			<p class="text-sm">บันทึกรหัสนี้ก่อนปิดหรือออกจากหน้า จะไม่สามารถเรียกดูรหัสเดิมได้อีก</p>
			<Input id="new-invite-code" readonly value={created.code} class="font-mono focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60" />
			<p class="break-all text-xs">สิทธิ์: {created.permission.join(", ")}</p>
			<p class="break-all text-xs">ID: {created.id}</p>
			<Button variant="cta" size="cta-sm" onclick={copyCode}>คัดลอกรหัส</Button>
			{#if copyMessage}<p role="status" class="text-sm">{copyMessage}</p>{/if}
			<Button variant="cta-light" size="cta-sm" disabled={busy} onclick={() => { created = null; }}>บันทึกรหัสแล้ว ปิด</Button>
		</Glass>
	{/if}

	{#if failure}<p role="alert" class="text-sm text-brand-yellow">{failure}</p>{/if}
	{#if message}<p role="status" class="text-sm text-brand-yellow">{message}</p>{/if}
	{#if refreshFailed}
		<div role="alert" class="flex flex-col gap-2 text-sm">
			<p>รายการยังไม่อัปเดต กรุณาโหลดรายการอีกครั้ง</p>
			<Button variant="cta-light" size="cta-sm" disabled={busy} onclick={refreshList}>โหลดรายการอีกครั้ง</Button>
		</div>
	{/if}

	<section class="flex flex-col gap-3" aria-labelledby="invite-list-heading" aria-busy={busy}>
		<h2 id="invite-list-heading" class="text-xl text-brand-yellow">รหัสเชิญทั้งหมด</h2>
		<p class="text-sm">การปิดรหัสจะหยุดการใช้ครั้งต่อไป แต่ไม่ถอนสิทธิ์ของผู้ที่ใช้รหัสไปแล้ว</p>
		{#each data.invites as invite (invite.id)}
			<Glass as="article" class="flex flex-col gap-3 rounded-xl p-4" aria-label={`รหัสเชิญ ${invite.id}`}>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class={invite.deletedAt ? "text-brand-mist/70" : "text-brand-yellow"}>
						{invite.deletedAt ? "ปิดใช้งานแล้ว" : "ใช้งานอยู่"}
					</span>
					{#if !invite.deletedAt}
						<Button variant="cta-light" size="cta-sm" disabled={busy} onclick={() => disable(invite.id)}>ปิดใช้งาน</Button>
					{/if}
				</div>
				<ul class="flex flex-wrap gap-2" aria-label="สิทธิ์">
					{#each invite.permission as permission (permission)}
						<li class="rounded-md bg-white/10 px-2 py-1 text-xs">{options.find((option) => option.value === permission)?.label ?? permission}</li>
					{/each}
				</ul>
				<p class="text-xs">สร้างเมื่อ: {invite.createdAt ? dateFormat.format(new Date(invite.createdAt)) : "ไม่ทราบวันที่"}</p>
				<p class="break-all text-xs text-brand-mist/70">ID: {invite.id}</p>
			</Glass>
		{:else}
			<p class="py-4 text-sm">ยังไม่มีรหัสเชิญในหน้านี้</p>
		{/each}
		<nav aria-label="หน้ารายการรหัสเชิญ" class="flex items-center justify-between gap-3">
			<Button variant="cta-light" size="cta-sm" href={`?page=${data.page - 1}`} disabled={busy || data.page === 1}>ก่อนหน้า</Button>
			<span class="text-sm">หน้า {data.page}</span>
			<Button variant="cta-light" size="cta-sm" href={`?page=${data.page + 1}`} disabled={busy || !data.hasNextPage}>ถัดไป</Button>
		</nav>
	</section>
</main>
