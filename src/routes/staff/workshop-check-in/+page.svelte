<script lang="ts" module>
	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});
</script>

<script lang="ts">
	import AttendeeDetails from "#lib/components/attendee-details.svelte";
	import ScanInput from "#lib/components/scan-input.svelte";
	import ScanSheet from "#lib/components/scan-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { Picker } from "#lib/components/ui/picker/index.js";
	import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { showError } from "#lib/error-dialog.svelte.js";
	import { httpStatus } from "#lib/utils.js";
	import { workshops } from "#lib/workshops.js";

	const workshopOptions = workshops.map((workshop) => ({ value: workshop.id, label: workshop.title }));

	let workshopId = $state(workshops[0]?.id ?? "");
	const workshop = $derived(workshops.find((candidate) => candidate.id === workshopId));
	const roundOptions = $derived(
		(workshop?.sessions ?? []).map((session) => ({
			value: session.id,
			label: `${timeFormat.format(new Date(session.start))} - ${timeFormat.format(new Date(session.end))}`,
		}))
	);
	let sessionId = $state(workshops[0]?.sessions[0]?.id ?? "");
	const session = $derived(workshop?.sessions.find((candidate) => candidate.id === sessionId));

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
	/** Null before the first lookup. Closing keeps the attendee, so the sheet still shows them as it slides away. */
	type Sheet = { attendee: Attendee; state: "confirming" | "closed" };
	let sheet = $state<Sheet | null>(null);
	const sheetOpen = $derived(sheet !== null && sheet.state !== "closed");

	function closeSheet() {
		if (sheet) sheet.state = "closed";
	}

	async function lookUp(qrCodeId: string) {
		// Pick the round before scanning, so the sheet confirms into a known round.
		if (!session) {
			await showError({ title: "ยังไม่ได้เลือกรอบเวลา", description: "กรุณาเลือกบูธเวิร์คช็อปและรอบเวลาก่อนสแกน" });
			return;
		}
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

	// TODO: no workshop check-in command yet (checkpoints have no workshop round).
	function confirm() {
		closeSheet();
		void showError({ title: "ยังไม่เปิดใช้งาน", description: "ระบบเช็คอินเวิร์คช็อปยังไม่พร้อมใช้งาน" });
	}
</script>

<svelte:head>
	<title>เช็คอินบูธเวิร์คช็อป | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">เช็คอินบูธเวิร์คช็อป</h1>

		<ScanInput onScan={lookUp} paused={sheetOpen} />

		<p class="w-full text-base text-brand-sky">
			*สามารถเช็คอินผู้เข้าร่วมงานได้ปกติจนถึงก่อนรอบเวลานั้น 5 นาที หลังจากนั้นจำเป็นต้องเปลี่ยนเป็นเพิ่มคนแทน
		</p>
		<div class="flex w-full flex-col gap-3">
			<label for="workshop" class="text-2xl text-brand-sky">เลือกบูธเวิร์คช็อป</label>
			<Picker
				id="workshop"
				options={workshopOptions}
				bind:value={workshopId}
				onValueChange={(value) => {
					sessionId = workshops.find((candidate) => candidate.id === value)?.sessions[0]?.id ?? "";
				}}
			/>
		</div>
		<div class="flex w-full flex-col gap-3">
			<label for="round" class="text-2xl text-brand-sky">เลือกรอบเวลา</label>
			<Picker id="round" options={roundOptions} bind:value={sessionId} />
		</div>
	</div>

	<!-- TODO: the participant list and walk-in ("เพิ่มคน") pages don't exist yet. -->
	<div class="flex w-full gap-2">
		<Button variant="cta-light" size="cta-lg" class="flex-1 border">รายชื่อผู้เข้าร่วม</Button>
		<Button variant="cta" size="cta-lg" class="flex-1">เพิ่มคน</Button>
	</div>
</main>

<ScanSheet open={sheetOpen} onclose={closeSheet}>
	{#if sheet}
		<div class="flex flex-1 flex-col items-center justify-between">
			<div class="flex w-full flex-col gap-6 px-4">
				<Drawer.Title class="text-center font-heading text-[28px] font-medium text-black">
					เช็คอินเวิร์คช็อป
				</Drawer.Title>
				<AttendeeDetails attendee={sheet.attendee} />
			</div>
			<div class="flex w-full flex-col gap-2">
				<Button variant="cta-light" size="cta-lg" class="w-full" onclick={closeSheet}>ยกเลิก</Button>
				<Button variant="cta" size="cta-lg" class="w-full" onclick={confirm}>ตกลง</Button>
			</div>
		</div>
	{/if}
</ScanSheet>
