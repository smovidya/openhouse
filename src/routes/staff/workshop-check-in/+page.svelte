<script lang="ts" module>
	import addNavyIcon from "#lib/assets/icons/add-circle-navy.svg";
	import addSkyIcon from "#lib/assets/icons/add-circle-sky.svg";
	import checkNavyIcon from "#lib/assets/icons/person-check-navy.svg";
	import checkSkyIcon from "#lib/assets/icons/person-check-sky.svg";
	import type { AttendanceMode } from "#lib/workshop-attendance.js";

	/** เช็คอิน lets in attendees who booked the round; เพิ่มคน also adds walk-ins (booked ones are just checked in). */
	type Mode = "check-in" | "add";

	const modes = {
		"check-in": {
			label: "เช็คอิน",
			api: "advance",
			sheetTitle: "เช็คอินผู้เข้าร่วมงาน",
			icons: { active: checkNavyIcon, inactive: checkSkyIcon },
		},
		add: {
			label: "เพิ่มคน",
			api: "open",
			sheetTitle: "เพิ่มผู้เข้าร่วมงาน",
			icons: { active: addNavyIcon, inactive: addSkyIcon },
		},
	} as const satisfies Record<
		Mode,
		{ label: string; api: AttendanceMode; sheetTitle: string; icons: { active: string; inactive: string } }
	>;
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import checkIcon from "#lib/assets/icons/check-circle-green.svg";
	import DetailList from "#lib/components/detail-list.svelte";
	import ScanInput from "#lib/components/scan-input.svelte";
	import ScanSheet from "#lib/components/scan-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { Picker } from "#lib/components/ui/picker/index.js";
	import { showError } from "#lib/error-dialog.svelte.js";
	import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { checkInWorkshop } from "#lib/features/workshops/attendance.remote.ts";
	import { httpStatus } from "#lib/utils.js";
	import { attendanceError, findSlotId, slotNotFound } from "#lib/workshop-attendance.js";
	import { findSession, roundLabel, workshops } from "#lib/workshops.js";

	// The round is in the URL (?session=), so the participant list's back button returns to it.
	const workshopOptions = workshops.map((workshop) => ({ value: workshop.id, label: workshop.title }));

	/** The workshop's next round that hasn't ended, else its first. */
	function defaultSessionId(workshopId: string) {
		const sessions = workshops.find((workshop) => workshop.id === workshopId)?.sessions ?? [];
		return (sessions.find((session) => Date.parse(session.end) > Date.now()) ?? sessions[0])?.id ?? "";
	}

	const initial = findSession(page.url.searchParams.get("session") ?? "");
	let workshopId = $state(initial?.workshop.id ?? workshops[0]?.id ?? "");
	let sessionId = $state(initial?.session.id ?? defaultSessionId(workshops[0]?.id ?? ""));
	const selected = $derived(findSession(sessionId));
	const roundOptions = $derived(
		(workshops.find((workshop) => workshop.id === workshopId)?.sessions ?? []).map((session) => ({
			value: session.id,
			label: roundLabel(session),
		}))
	);

	function select(id: string) {
		sessionId = id;
		const url = new URL(page.url.href);
		url.searchParams.set("session", id);
		// Shallow: only the URL changes; the page and the scanner stay as they are.
		void goto(url, { replace: true, shallow: true });
	}

	let mode = $state<Mode>("check-in");

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
	/**
	 * Null before the first lookup. Closing keeps the attendee, so the sheet still shows them as it
	 * slides away. The mode and round are fixed when the sheet opens.
	 */
	type Sheet = {
		attendee: Attendee;
		mode: Mode;
		sessionId: string;
		state: "confirming" | "saving" | "closed";
	};
	let sheet = $state<Sheet | null>(null);
	const sheetOpen = $derived(sheet !== null && sheet.state !== "closed");
	const sheetRound = $derived(sheet && findSession(sheet.sessionId));
	/** Result of the last successful check-in. */
	let message = $state<string | null>(null);
	let code = $state("");

	function closeSheet() {
		if (sheet) sheet.state = "closed";
	}

	async function lookUp(qrCodeId: string) {
		message = null;
		// Pick the round before scanning, so the sheet confirms into a known round.
		if (!selected) {
			await showError({ title: "ยังไม่ได้เลือกรอบเวลา", description: "กรุณาเลือกบูธเวิร์คช็อปและรอบเวลาก่อนสแกน" });
			return;
		}
		try {
			const attendee = await getAttendeeProfileByQrCodeId(qrCodeId);
			sheet = { attendee, mode, sessionId: selected.session.id, state: "confirming" };
		} catch (caught) {
			// Awaited: the scanner stays frozen until it's dismissed.
			await showError(
				httpStatus(caught) === 404
					? { title: "ไม่พบผู้เข้าร่วมงาน", description: "ไม่พบผู้เข้าร่วมงานจากรหัสนี้ กรุณาตรวจสอบแล้วลองอีกครั้ง" }
					: { title: "ค้นหาไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		}
	}

	async function confirm() {
		const current = sheet;
		if (current?.state !== "confirming") return;
		const { attendee } = current;
		current.state = "saving";
		const name = `${attendee.firstname} ${attendee.lastname}`;
		try {
			const round = findSession(current.sessionId);
			const slotId = round && (await findSlotId(round.session));
			if (!slotId) {
				void showError(slotNotFound);
				return;
			}
			const result = await checkInWorkshop({
				workshopTimeSlotId: slotId,
				qrCodeId: attendee.qrCodeId,
				mode: modes[current.mode].api,
			});
			message =
				result.log.attendanceType === "walk-in" ? `เพิ่ม ${name} เข้ารอบนี้แล้ว` : `เช็คอิน ${name} แล้ว`;
			code = "";
		} catch (caught) {
			void showError(attendanceError(caught));
		} finally {
			current.state = "closed";
		}
	}
</script>

<svelte:head>
	<title>{modes[mode].label}บูธเวิร์คช็อป | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">
			<u>{modes[mode].label}</u> บูธเวิร์คช็อป
		</h1>

		<ScanInput submitLabel="ลงทะเบียน" onScan={lookUp} paused={sheetOpen} bind:code>
			{#snippet header()}
				<!-- Mode switch (Figma): two halves, the active one sky blue. -->
				<div class="flex w-full" role="group" aria-label="โหมด">
					{#each ["check-in", "add"] as const as option, index (option)}
						{@const active = mode === option}
						<button
							type="button"
							aria-pressed={active}
							class={[
								"flex flex-1 cursor-pointer items-center justify-center gap-1 py-2 font-heading text-sm",
								index === 0 ? "rounded-l-lg" : "rounded-r-lg",
								active ? "border-2 border-brand-blue bg-brand-sky text-brand-navy" : "bg-brand-mist text-brand-sky",
							]}
							onclick={() => (mode = option)}
						>
							<img src={active ? modes[option].icons.active : modes[option].icons.inactive} alt="" />
							{modes[option].label}
						</button>
					{/each}
				</div>
			{/snippet}
		</ScanInput>

		{#if message}
			<p role="status" class="flex items-center justify-center gap-1 text-center text-sm text-brand-mist">
				<img src={checkIcon} alt="" />
				{message}
			</p>
		{/if}

		<div class="flex w-full flex-col gap-3">
			<label for="workshop" class="text-2xl text-brand-sky">เลือกบูธเวิร์คช็อป</label>
			<Picker
				id="workshop"
				class="border-brand-sky"
				options={workshopOptions}
				bind:value={workshopId}
				onValueChange={(value) => select(defaultSessionId(value))}
			/>
		</div>
		<div class="flex w-full flex-col gap-3">
			<label for="round" class="text-2xl text-brand-sky">เลือกรอบเวลา</label>
			<Picker id="round" class="border-brand-sky" options={roundOptions} value={sessionId} onValueChange={select} />
		</div>
	</div>

	<div class="flex w-full gap-2">
		<Button
			variant="cta-light"
			size="cta-lg"
			class="flex-1 border"
			href="/staff/workshop-check-in/participants?session={encodeURIComponent(sessionId)}"
		>
			รายชื่อผู้เข้าร่วม
		</Button>
		<Button variant="cta" size="cta-lg" class="flex-1" href="/staff">ย้อนกลับ</Button>
	</div>
</main>

<ScanSheet open={sheetOpen} onclose={closeSheet}>
	{#if sheet}
		<div class="flex flex-1 flex-col items-center justify-between">
			<div class="flex w-full flex-col gap-6 px-4">
				<Drawer.Title class="text-center font-heading text-[28px] font-medium text-black">
					{modes[sheet.mode].sheetTitle}
				</Drawer.Title>
				<div class="flex flex-col gap-4">
					<DetailList
						rows={[
							["ชื่อ", `${sheet.attendee.firstname} ${sheet.attendee.lastname}`],
							["อีเมล", sheet.attendee.email ?? "-"],
						]}
					/>
					<hr class="border-brand-sky" />
					{#if sheetRound}
						<DetailList
							rows={[
								["บูธเวิร์คช็อป", sheetRound.workshop.title],
								["รอบเวลา", roundLabel(sheetRound.session)],
							]}
						/>
					{/if}
				</div>
			</div>
			<div class="flex w-full flex-col gap-2">
				<Button variant="cta-light" size="cta-lg" class="w-full" onclick={closeSheet}>ยกเลิก</Button>
				<Button variant="cta" size="cta-lg" class="w-full" disabled={sheet.state !== "confirming"} onclick={confirm}>
					{sheet.state === "saving" ? "กำลังบันทึก…" : "ตกลง"}
				</Button>
			</div>
		</div>
	{/if}
</ScanSheet>
