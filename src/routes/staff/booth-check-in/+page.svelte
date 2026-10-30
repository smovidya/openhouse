<script lang="ts" module>
	import type { ErrorMessage } from "#lib/error-dialog.svelte.js";

	// checkInAttendee's 409 messages (ALREADY_CHECKED_IN is a status, not an error).
	const rejections = {
		ENTRY_REQUIRED: {
			title: "ยังไม่ได้ผ่านจุดลงทะเบียน",
			description: "ให้ผู้เข้าร่วมงานไปรับของที่ระลึกที่จุดลงทะเบียนก่อน แล้วกลับมาใหม่",
		},
		JOURNEY_REDEEMED: {
			title: "แลกของรางวัลไปแล้ว",
			description: "ผู้เข้าร่วมงานแลกของรางวัลไปแล้ว จึงสะสมบูธเพิ่มไม่ได้",
		},
	} as const satisfies Record<string, ErrorMessage>;

	type Rejection = keyof typeof rejections;
	const isRejection = (code: string | null): code is Rejection => code !== null && Object.hasOwn(rejections, code);
</script>

<script lang="ts">
	import { untrack } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import checkIcon from "#lib/assets/icons/check-circle-green.svg";
	import AttendeeDetails from "#lib/components/attendee-details.svelte";
	import DetailList from "#lib/components/detail-list.svelte";
	import ScanInput from "#lib/components/scan-input.svelte";
	import ScanSheet from "#lib/components/scan-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { Picker } from "#lib/components/ui/picker/index.js";
	import { showError } from "#lib/error-dialog.svelte.js";
	import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { checkInAttendee, getStaffAttendeeProgress } from "#lib/features/checkpoints/checkpoints.remote.ts";
	import { httpErrorMessage, httpStatus } from "#lib/utils.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const boothName = (checkpoint: { id: string; name: string | null }) => checkpoint.name ?? checkpoint.id;
	const boothOptions = $derived(
		data.checkpoints.map((checkpoint) => ({ value: checkpoint.id, label: boothName(checkpoint) }))
	);

	// The booth is in the URL (?checkpoint=), so a reload or the history page's back button keeps it.
	// With a single booth (most department staff), it's picked already.
	const requested = page.url.searchParams.get("checkpoint");
	// Only the starting value: after that the picker sets it.
	let checkpointId = $state(
		untrack(
			() =>
				data.checkpoints.find((checkpoint) => checkpoint.id === requested)?.id ??
				(data.checkpoints.length === 1 ? data.checkpoints[0].id : "")
		)
	);
	const booth = $derived(data.checkpoints.find((checkpoint) => checkpoint.id === checkpointId));

	function select(id: string) {
		checkpointId = id;
		const url = new URL(page.url.href);
		url.searchParams.set("checkpoint", id);
		// Shallow: only the URL changes; the page and the scanner stay as they are.
		void goto(url, { replace: true, shallow: true });
	}

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
	/**
	 * Null before the first lookup. Closing keeps the contents, so the sheet still shows them as it
	 * slides away. The booth is fixed when the sheet opens.
	 */
	type Sheet = {
		attendee: Attendee;
		booth: { id: string; name: string };
		/** Whether the attendee has been scanned at the registration point (entry log). */
		entered: boolean;
		state: "confirming" | "checkingIn" | "closed";
	};
	let sheet = $state<Sheet | null>(null);
	const sheetOpen = $derived(sheet !== null && sheet.state !== "closed");
	/** Result of the last check-in. */
	let message = $state<string | null>(null);
	let code = $state("");

	function closeSheet() {
		if (sheet) sheet.state = "closed";
	}

	async function lookUp(qrCodeId: string) {
		message = null;
		// Pick the booth before scanning, so the sheet confirms into a known booth.
		if (!booth) {
			await showError({ title: "กรุณาเลือกบูธ", description: "กรุณาเลือกบูธนิทรรศการก่อนสแกนหรือกรอกรหัส" });
			return;
		}
		try {
			const [attendee, { progress }] = await Promise.all([
				getAttendeeProfileByQrCodeId(qrCodeId),
				getStaffAttendeeProgress({ qrCodeId }),
			]);
			sheet = { attendee, booth: { id: booth.id, name: boothName(booth) }, entered: progress.entered, state: "confirming" };
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
		if (current?.state !== "confirming" || !current.entered) return;
		const { attendee } = current;
		current.state = "checkingIn";
		const name = `${attendee.firstname} ${attendee.lastname}`;
		try {
			await checkInAttendee({ qrCodeId: attendee.qrCodeId, checkpointId: current.booth.id });
			message = `เช็คอิน ${name} ที่ ${current.booth.name} แล้ว`;
			code = "";
		} catch (caught) {
			const reason = httpErrorMessage(caught);
			// A repeat scan isn't a failure: say so the same way as a check-in.
			if (reason === "ALREADY_CHECKED_IN") {
				message = `${name} เช็คอิน ${current.booth.name} ไปแล้วก่อนหน้านี้`;
				code = "";
				return;
			}
			void showError(
				isRejection(reason)
					? rejections[reason]
					: httpStatus(caught) === 403
						? { title: "ไม่มีสิทธิ์", description: "บัญชีนี้ไม่มีสิทธิ์เช็คอินบูธนี้" }
						: { title: "เช็คอินไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		} finally {
			current.state = "closed";
		}
	}
</script>

<svelte:head>
	<title>เช็คอินบูธนิทรรศการ | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">เช็คอินบูธนิทรรศการ</h1>

		<ScanInput submitLabel="ลงทะเบียน" onScan={lookUp} paused={sheetOpen} bind:code />

		{#if message}
			<p role="status" class="flex items-center justify-center gap-1 text-center text-sm text-brand-mist">
				<img src={checkIcon} alt="" />
				{message}
			</p>
		{/if}

		<div class="flex w-full flex-col gap-3">
			<label for="booth" class="text-2xl text-brand-sky">เลือกบูธนิทรรศการ</label>
			{#if boothOptions.length > 0}
				<Picker
					id="booth"
					class="border-brand-sky"
					options={boothOptions}
					value={checkpointId}
					placeholder="กรุณาเลือกบูธ"
					onValueChange={select}
				/>
			{:else}
				<p class="text-base text-brand-mist">ไม่พบบูธที่บัญชีนี้เช็คอินได้</p>
			{/if}
		</div>
	</div>

	<div class="flex w-full flex-col gap-2">
		<!-- Hidden until the history page has data (no query returns a booth's check-ins yet).
		<Button variant="cta-light" size="cta-lg" class="w-full border" href="/staff/booth-check-in/history">
			ดูประวัติการเช็คอิน
		</Button>
		-->
		<Button variant="cta" size="cta-lg" class="w-full" href="/staff">ย้อนกลับ</Button>
	</div>
</main>

<ScanSheet open={sheetOpen} onclose={closeSheet}>
	{#if sheet}
		<div class="flex flex-1 flex-col items-center justify-between">
			<div class="flex w-full flex-col gap-4 px-4">
				<Drawer.Title class="text-center font-heading text-[28px] font-medium text-black">
					เช็คอินผู้เข้าร่วมงาน
				</Drawer.Title>
				<AttendeeDetails attendee={sheet.attendee} />
				<hr class="border-brand-sky" />
				<DetailList rows={[["บูธนิทรรศการ", sheet.booth.name]]} />
				{#if !sheet.entered}
					<p role="alert" class="text-center font-heading text-xl text-brand-navy">
						ยังไม่ได้ผ่านจุดลงทะเบียน ให้ไปรับของที่ระลึกที่จุดลงทะเบียนก่อน แล้วกลับมาใหม่
					</p>
				{/if}
			</div>
			<div class="flex w-full flex-col gap-2">
				<Button variant="cta-light" size="cta-lg" class="w-full" onclick={closeSheet}>ยกเลิก</Button>
				<Button variant="cta" size="cta-lg" class="w-full" disabled={!sheet.entered || sheet.state !== "confirming"} onclick={confirm}>
					{sheet.state === "checkingIn" ? "กำลังเช็คอิน…" : "ตกลง"}
				</Button>
			</div>
		</div>
	{/if}
</ScanSheet>
