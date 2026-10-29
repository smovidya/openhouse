<script lang="ts">
	import { page } from "$app/state";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { showError } from "#lib/error-dialog.svelte.js";
	import { mockAttendeeEmail } from "#lib/mock/attendees.js";
	import {
		getWorkshopAttendanceStats,
		listWorkshopAttendance,
		setWorkshopAttendance,
		type RosterRow,
	} from "#lib/mock/workshop-attendance.svelte.js";
	import { SvelteSet } from "svelte/reactivity";
	import { httpErrorMessage } from "#lib/utils.js";
	import { isRejection, rejectionMessages } from "#lib/workshop-attendance.js";
	import { findSession, roundLabel } from "#lib/workshops.js";

	// A round's roster (Figma "บูธเวิร์คช็อป"): booked attendees with a check-in switch, then walk-ins.
	// MOCK data until the attendance API exists (see #lib/mock/workshop-attendance.svelte.ts).
	const sessionId = $derived(page.url.searchParams.get("session") ?? "");
	const round = $derived(findSession(sessionId));
	const roster = $derived(round ? listWorkshopAttendance({ workshopTimeSlotId: sessionId }).roster : []);
	const stats = $derived(round && getWorkshopAttendanceStats({ workshopTimeSlotId: sessionId }));
	const booked = $derived(roster.filter((row) => row.registrationType === "advance"));
	const walkIns = $derived(roster.filter((row) => row.attendance === "walk-in"));

	/** Rows with a request in flight, by attendee id. */
	const saving = new SvelteSet<string>();
	/**
	 * A walk-in's ลบออก. The row is removed only once the dialog has finished closing: removing it
	 * (and its ลบออก button) mid-close leaves the dialog's overlay stuck over the page.
	 */
	type Removal = { row: RosterRow; state: "asking" | "confirmed" | "cancelled" };
	let removal = $state<Removal | null>(null);

	async function setPresent(row: RosterRow, present: boolean) {
		const { id } = row.attendee;
		if (saving.has(id)) return;
		saving.add(id);
		try {
			await setWorkshopAttendance({ workshopTimeSlotId: sessionId, attendeeId: id, present, mode: "advance" });
		} catch (caught) {
			const reason = httpErrorMessage(caught);
			void showError(
				isRejection(reason)
					? rejectionMessages[reason]
					: { title: "บันทึกไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		} finally {
			saving.delete(id);
		}
	}

	const fullName = (row: RosterRow) => `${row.attendee.firstname} ${row.attendee.lastname}`;
	const backHref = $derived(`/staff/workshop-check-in?session=${encodeURIComponent(sessionId)}`);
</script>

<svelte:head>
	<title>รายชื่อผู้เข้าร่วม | Science Chula Openhouse</title>
</svelte:head>

{#snippet person(row: RosterRow)}
	<div class={["min-w-0 flex-1 text-base break-words", row.attendance ? "text-status-green" : "text-brand-mist"]}>
		<p>{fullName(row)}</p>
		<p>{mockAttendeeEmail(row.attendee)}</p>
	</div>
{/snippet}

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">บูธเวิร์คช็อป</h1>

		{#if !round || !stats}
			<p class="text-center text-base text-brand-mist">ไม่พบรอบเวลานี้ กรุณาเลือกบูธเวิร์คช็อปและรอบเวลาใหม่</p>
		{:else}
			<section class="flex flex-col gap-2">
				<h2 class="text-2xl text-brand-sky">รายชื่อผู้เข้าร่วม</h2>
				<div class="flex flex-col gap-6">
					<div class="flex flex-col gap-2 text-base">
						<dl class="flex flex-col rounded-lg border border-brand-sky p-2">
							{#each [
								["บูธเวิร์คช็อป", round.workshop.title],
								["รอบเวลา", roundLabel(round.session)],
							] as [label, value] (label)}
								<div class="flex justify-center gap-2.5">
									<dt class="w-[70px] shrink-0 text-brand-mist">{label}</dt>
									<dd class="text-brand-sky">{value}</dd>
								</div>
							{/each}
						</dl>
						<dl class="flex flex-col rounded-lg border border-brand-yellow p-2 text-brand-mist" aria-label="สรุปจำนวน">
							{#each [
								["เช็คอินแล้ว", `${stats.advanceArrivals}/${stats.advanceBookings}`],
								["เพิ่มคนแล้ว", `${stats.walkInArrivals}`],
								["รวมทั้งหมด", `${stats.totalAttendance}`],
							] as [label, value] (label)}
								<div class="flex justify-center gap-2.5">
									<dt>{label}</dt>
									<dd><span class="text-brand-yellow">{value}</span> คน</dd>
								</div>
							{/each}
						</dl>
					</div>

					<section class="flex flex-col gap-2">
						<h3 class="text-2xl text-brand-sky">คนที่ลงทะเบียนล่วงหน้า</h3>
						{#each booked as row (row.attendee.id)}
							<div class="flex items-center gap-6">
								{@render person(row)}
								<!-- Switch (Figma): 43×25, the knob slides right and turns green when present. -->
								<button
									type="button"
									role="switch"
									aria-checked={row.attendance !== null}
									aria-label="เช็คอิน {fullName(row)}"
									disabled={saving.has(row.attendee.id)}
									class={[
										"relative h-[25px] w-[43px] shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50",
										row.attendance ? "bg-status-green" : "bg-brand-mist",
									]}
									onclick={() => setPresent(row, row.attendance === null)}
								>
									<span
										class={[
											"absolute top-[5px] size-4 rounded-full transition-[left]",
											row.attendance ? "left-[22px] bg-[#257a00]" : "left-1 bg-brand-navy",
										]}
									></span>
								</button>
							</div>
						{:else}
							<p class="text-base text-brand-mist">ยังไม่มีผู้ลงทะเบียนล่วงหน้า</p>
						{/each}
					</section>

					<hr class="border-brand-sky" />

					<section class="flex flex-col gap-2">
						<h3 class="text-2xl text-brand-sky">คนที่เพิ่ม</h3>
						{#each walkIns as row (row.attendee.id)}
							<div class="flex items-center gap-6">
								{@render person(row)}
								<Button
									variant="cta-light"
									size="cta-sm"
									class="w-20 border"
									disabled={saving.has(row.attendee.id)}
									onclick={() => (removal = { row, state: "asking" })}
								>
									ลบออก
								</Button>
							</div>
						{:else}
							<p class="text-base text-brand-mist">ยังไม่มีคนที่เพิ่ม</p>
						{/each}
					</section>
				</div>
			</section>
		{/if}
	</div>

	<Button variant="cta" size="cta-lg" href={backHref} class="w-full">ย้อนกลับ</Button>
</main>

<AlertDialog.Root
	open={removal?.state === "asking"}
	onOpenChange={(open) => {
		if (!open && removal?.state === "asking") removal.state = "cancelled";
	}}
	onOpenChangeComplete={(open) => {
		if (open || !removal) return;
		if (removal.state === "confirmed") void setPresent(removal.row, false);
		removal = null;
	}}
>
	<AlertDialog.Content class="bg-brand-mist">
		{#if removal}
			{@const row = removal.row}
			<AlertDialog.Header>
				<AlertDialog.Title class="font-heading text-xl font-medium text-black">ลบออกจากรอบนี้?</AlertDialog.Title>
				<AlertDialog.Description class="text-base text-brand-navy">
					{fullName(row)} จะถูกลบออกจากรายชื่อคนที่เพิ่มของรอบนี้
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel variant="cta-light" size="cta-sm">ยกเลิก</AlertDialog.Cancel>
				<!-- Action doesn't close the dialog by itself. -->
				<AlertDialog.Action
					variant="cta"
					size="cta-sm"
					onclick={() => {
						if (removal) removal.state = "confirmed";
					}}
				>
					ลบออก
				</AlertDialog.Action>
			</AlertDialog.Footer>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
