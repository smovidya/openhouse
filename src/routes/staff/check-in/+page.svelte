<script lang="ts">
	import checkIcon from "#lib/assets/icons/check-circle-green.svg";
	import AttendeeDetails from "#lib/components/attendee-details.svelte";
	import ScanInput from "#lib/components/scan-input.svelte";
	import ScanSheet from "#lib/components/scan-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { checkInAttendee } from "#lib/features/checkpoints/checkpoints.remote.ts";
	import { showError } from "#lib/error-dialog.svelte.js";
	import { httpStatus } from "#lib/utils.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
	/** Null before the first lookup. Closing keeps the attendee, so the sheet still shows them as it slides away. */
	type Sheet = { attendee: Attendee; state: "confirming" | "checkingIn" | "closed" };
	let sheet = $state<Sheet | null>(null);
	const sheetOpen = $derived(sheet !== null && sheet.state !== "closed");
	/** Result of the last successful check-in. */
	let message = $state<string | null>(null);
	let code = $state("");

	async function lookUp(qrCodeId: string) {
		message = null;
		try {
			sheet = { attendee: await getAttendeeProfileByQrCodeId(qrCodeId), state: "confirming" };
		} catch (caught) {
			// Awaited: the scanner stays frozen until it's dismissed.
			await showError(
				httpStatus(caught) === 404
					? { title: "ไม่พบผู้เข้าร่วมงาน", description: "ไม่พบผู้เข้าร่วมงานจากรหัสนี้ กรุณาตรวจสอบแล้วลองอีกครั้ง" }
					: { title: "ค้นหาไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		}
	}

	function closeSheet() {
		if (sheet) sheet.state = "closed";
	}

	async function confirm() {
		const current = sheet;
		if (current?.state !== "confirming") return;
		const { attendee } = current;
		if (!data.entry) {
			current.state = "closed";
			void showError({ title: "ไม่พบจุดลงทะเบียน", description: "ยังไม่ได้ตั้งค่าจุดลงทะเบียน กรุณาติดต่อผู้ดูแลระบบ" });
			return;
		}
		current.state = "checkingIn";
		const name = `${attendee.firstname} ${attendee.lastname}`;
		try {
			const result = await checkInAttendee({ qrCodeId: attendee.qrCodeId, checkpointId: data.entry.id });
			message = result.alreadyCheckedIn ? `${name} เช็คอินไปแล้วก่อนหน้านี้` : `เช็คอิน ${name} แล้ว`;
			code = "";
		} catch (caught) {
			void showError(
				httpStatus(caught) === 403
					? { title: "ไม่มีสิทธิ์", description: "บัญชีนี้ไม่มีสิทธิ์เช็คอินจุดลงทะเบียน" }
					: { title: "เช็คอินไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		} finally {
			current.state = "closed";
		}
	}
</script>

<svelte:head>
	<title>เช็คอินจุดลงทะเบียน | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">เช็คอินจุดลงทะเบียน</h1>

		<ScanInput submitLabel="ลงทะเบียน" onScan={lookUp} paused={sheetOpen} bind:code />

		{#if message}
			<p role="status" class="flex items-center justify-center gap-1 text-center text-sm text-brand-mist">
				<img src={checkIcon} alt="" />
				{message}
			</p>
		{/if}
	</div>

	<Button variant="cta" size="cta-lg" href="/staff" class="w-full">ย้อนกลับ</Button>
</main>

<ScanSheet open={sheetOpen} onclose={closeSheet}>
	{#if sheet}
		<div class="flex flex-1 flex-col items-center justify-between">
			<div class="flex w-full flex-col gap-6 px-4">
				<Drawer.Title class="text-center font-heading text-[28px] font-medium text-black">
					เช็คอินผู้เข้าร่วมงาน
				</Drawer.Title>
				<AttendeeDetails attendee={sheet.attendee} />
			</div>
			<div class="flex w-full flex-col gap-2">
				<Button variant="cta-light" size="cta-lg" class="w-full" onclick={closeSheet}>ยกเลิก</Button>
				<Button variant="cta" size="cta-lg" class="w-full" disabled={sheet.state !== "confirming"} onclick={confirm}>
					{sheet.state === "checkingIn" ? "กำลังเช็คอิน…" : "ตกลง"}
				</Button>
			</div>
		</div>
	{/if}
</ScanSheet>
