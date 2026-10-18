<script lang="ts" module>
	import addCircleIcon from "#lib/assets/icons/add-circle-blue.svg";
	import cancelRedIcon from "#lib/assets/icons/cancel-red.svg";
	import checkCircleGreenIcon from "#lib/assets/icons/check-circle-green.svg";
	import { EVENT_SCHEDULE } from "#lib/constants/time.ts";
	import { MAX_ADVANCE_WORKSHOP_REGISTRATIONS } from "#lib/constants/workshops.ts";
	import type { SessionStatus } from "#lib/workshops.js";

	const dayFormat = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "full",
		timeZone: "Asia/Bangkok",
	});
	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	const statusLook: Record<SessionStatus, { label: string; icon: string; class: string }> = {
		available: {
			label: "กดเพื่อลงทะเบียน",
			icon: addCircleIcon,
			class: "border-brand-blue text-brand-blue",
		},
		full: { label: "เต็ม", icon: cancelRedIcon, class: "border-status-red text-status-red" },
		conflict: {
			label: "เวลาชนกับกิจกรรมอื่น",
			icon: cancelRedIcon,
			class: "border-status-red text-status-red",
		},
		registered: {
			label: "ลงทะเบียนแล้ว",
			icon: checkCircleGreenIcon,
			class: "border-status-green text-status-green",
		},
		// One round per workshop: the attendee holds another round of this one.
		"other-round": {
			label: "กดเพื่อเปลี่ยนมารอบนี้",
			icon: checkCircleGreenIcon,
			class: "border-brand-sky text-brand-navy",
		},
	};

	const opensAt = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: "Asia/Bangkok",
	}).format(new Date(EVENT_SCHEDULE.workshopRegistrationOpensAt));

	/** Booking error codes from registerForWorkshop, in Thai. */
	function bookingError(code: string) {
		switch (code) {
			case "WORKSHOP_REGISTRATION_NOT_OPEN":
				return `ยังไม่เปิดให้ลงทะเบียนเวิร์กช็อป (เปิด ${opensAt} น.)`;
			case "WORKSHOP_REGISTRATION_CLOSED":
				return "ปิดรับลงทะเบียนเวิร์กช็อปแล้ว";
			case "WORKSHOP_FULL":
				return "รอบนี้เต็มแล้ว";
			case "WORKSHOP_TIME_CONFLICT":
				return "เวลาชนกับเวิร์กช็อปที่ลงทะเบียนไว้แล้ว";
			case "ALREADY_REGISTERED_FOR_WORKSHOP":
				return "ลงทะเบียนเวิร์กช็อปนี้ไว้แล้ว";
			case "WORKSHOP_ADVANCE_REGISTRATION_LIMIT_REACHED":
				return `ลงทะเบียนล่วงหน้าได้สูงสุด ${MAX_ADVANCE_WORKSHOP_REGISTRATIONS} เวิร์กช็อป`;
			case "WORKSHOP_ALREADY_STARTED":
				return "รอบนี้เริ่มไปแล้ว";
			case "ATTENDEE_NOT_FOUND":
				return "กรุณาลงทะเบียนเข้าร่วมงานก่อน";
			case "WORKSHOP_REGISTRATION_NOT_FOUND":
				return "ไม่พบการลงทะเบียนรอบนี้ อาจถูกยกเลิกไปแล้ว";
			default:
				return "ลงทะเบียนไม่สำเร็จ กรุณาลองอีกครั้ง";
		}
	}
</script>

<script lang="ts">
	import calendarIcon from "#lib/assets/icons/calendar-lg.svg";
	import infoIcon from "#lib/assets/icons/info.svg";
	import Glass from "#lib/render/glass.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { refreshAll } from "$app/navigation";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import {
		registerForWorkshop,
		unregisterFromWorkshop,
	} from "#lib/features/workshops/workshops.remote.ts";
	import {
		sessionsByDay,
		sessionStatus,
		type BookedSession,
		type WorkshopSession,
	} from "#lib/workshops.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const workshop = $derived(data.workshop);
	const canBook = $derived(data.attendee === "registered");

	/** The session being changed and what is happening to it, while the request runs. */
	let pending = $state<{ id: string; label: string } | null>(null);
	let message = $state("");

	/** A cancel or round change waiting for the attendee to confirm. */
	let confirming = $state<
		| { kind: "cancel"; session: WorkshopSession }
		| { kind: "change"; session: WorkshopSession; from: BookedSession }
		| null
	>(null);

	const roundTime = (session: { start: string; end: string }) =>
		`${dayFormat.format(new Date(session.start))} ${timeFormat.format(new Date(session.start))} - ${timeFormat.format(new Date(session.end))} น.`;

	/** Run one booking change, show its error if any, and reload the page data. */
	async function run(session: WorkshopSession, label: string, action: () => Promise<string | null>) {
		if (pending) return;
		pending = { id: session.id, label };
		message = "";
		try {
			const error = await action();
			if (error !== null) message = bookingError(error);
			// The attendee's bookings come from the server load.
			await refreshAll();
		} catch {
			message = bookingError("");
		} finally {
			pending = null;
		}
	}

	const round = (session: Pick<WorkshopSession, "workshop" | "round">) => ({
		workshopSlug: session.workshop,
		workshopRoundNumber: session.round,
	});

	function register(session: WorkshopSession) {
		return run(session, "กำลังลงทะเบียน…", async () => {
			const result = await registerForWorkshop(round(session));
			return result.isErr() ? result.error : null;
		});
	}

	function cancel(session: WorkshopSession) {
		return run(session, "กำลังยกเลิก…", async () => {
			const result = await unregisterFromWorkshop(round(session));
			return result.isErr() ? result.error : null;
		});
	}

	// No change-round API: cancel the old round, book the new one, and rebook the old one if
	// booking fails (e.g. the new round filled up meanwhile).
	function change(session: WorkshopSession, from: BookedSession) {
		return run(session, "กำลังเปลี่ยนรอบ…", async () => {
			const cancelled = await unregisterFromWorkshop(round(from));
			if (cancelled.isErr()) return cancelled.error;
			const booked = await registerForWorkshop(round(session));
			if (booked.isOk()) return null;
			await registerForWorkshop(round(from));
			return booked.error;
		});
	}

	function press(session: WorkshopSession, status: SessionStatus) {
		if (status === "available") return register(session);
		if (status === "registered") confirming = { kind: "cancel", session };
		if (status === "other-round") {
			const from = data.booked.find((other) => other.workshop === session.workshop);
			if (from) confirming = { kind: "change", session, from };
		}
	}

	function confirm() {
		if (!confirming) return;
		const { kind, session } = confirming;
		if (kind === "cancel") cancel(session);
		else change(session, confirming.from);
		confirming = null;
	}

	/** Rows that do something when pressed. */
	const pressable = (status: SessionStatus) =>
		status === "available" || status === "registered" || status === "other-round";
</script>

<svelte:head>
	<title>{workshop.title} | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col justify-between gap-6 px-3 pt-6 pb-4">
	<div class="flex flex-col items-center gap-6">
		<SignBoard title="WORKSHOP" wide />

		<Glass as="article" class="flex w-full flex-col gap-3 rounded-lg p-3">
			<header class="text-center">
				<h2 class="text-lg font-medium text-brand-yellow">{workshop.title}</h2>
				<p class="text-[10px] text-brand-mist">{workshop.hostDepartmentAbbr}</p>
			</header>

			{#if workshop.description}
				<section>
					<h3 class="flex items-center gap-1 text-sm text-brand-yellow">
						<img src={infoIcon} alt="" />
						รายละเอียดกิจกรรม
					</h3>
					<p class="text-xs text-brand-mist">{workshop.description}</p>
				</section>
			{/if}

			<section class="flex flex-col gap-2">
				<div class="flex items-center gap-2 text-brand-yellow">
					<h3 class="flex items-center gap-1 text-sm">
						<img src={calendarIcon} alt="" />
						รอบกิจกรรม
					</h3>
					<p class="text-xs">(กดที่รอบเวลาว่างเพื่อลงทะเบียน)</p>
				</div>

				{#if !canBook}
					<!-- Booking needs a registered attendee. -->
					<div class="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-brand-mist">
						<p>
							{data.attendee === "signed-out"
								? "เข้าสู่ระบบและลงทะเบียนเข้าร่วมงานก่อนเลือกรอบเวิร์กช็อป"
								: "ลงทะเบียนเข้าร่วมงานก่อนเลือกรอบเวิร์กช็อป"}
						</p>
						<Button
							variant="cta"
							size="cta-sm"
							href={data.attendee === "signed-out" ? "/#register" : "/register"}
						>
							{data.attendee === "signed-out" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}
						</Button>
					</div>
				{/if}

				{#each sessionsByDay(workshop.sessions) as { day, sessions } (day)}
					<time datetime={day} class="text-xs text-brand-mist">
						{dayFormat.format(new Date(sessions[0].start))}
					</time>
					{#each sessions as session (session.id)}
						{@const status = sessionStatus(session, data.booked)}
						{@const look = statusLook[status]}
						{@const rowClass = [
							"flex w-full items-start justify-between rounded-lg border bg-brand-mist px-4 py-2 text-xs",
							look.class,
						]}
						{#snippet row()}
							<span class="flex items-center gap-4 text-brand-navy">
								<span>
									<time datetime={session.start}>{timeFormat.format(new Date(session.start))}</time> -
									<time datetime={session.end}>{timeFormat.format(new Date(session.end))}</time>
								</span>
								{#if session.registered !== null}
									<span>จำนวน {session.registered}/{session.capacity}</span>
								{/if}
							</span>
							<span class="flex items-center gap-1">
								{pending?.id === session.id ? pending.label : look.label}
								<img src={look.icon} alt="" />
							</span>
						{/snippet}

						{#if pressable(status) && canBook}
							<button
								type="button"
								data-session={session.id}
								data-status={status}
								disabled={pending !== null}
								class={[
									rowClass,
									"cursor-pointer transition-colors outline-none disabled:cursor-wait disabled:opacity-70 hover:bg-white focus-visible:ring-3 focus-visible:ring-brand-mist active:bg-[color-mix(in_oklab,var(--color-brand-mist),var(--color-brand-blue)_15%)]",
								]}
								onclick={() => press(session, status)}
							>
								{@render row()}
							</button>
						{:else}
							<div class={rowClass} data-session={session.id} data-status={status}>{@render row()}</div>
						{/if}
					{/each}
				{/each}

				{#if message}
					<p role="alert" class="text-sm text-brand-yellow">{message}</p>
				{/if}
			</section>

			<AlertDialog.Root
				open={confirming !== null}
				onOpenChange={(open) => {
					if (!open) confirming = null;
				}}
			>
				<AlertDialog.Content
					class="border border-white/30 bg-brand-navy/80 text-brand-mist ring-0 backdrop-blur-xl backdrop-saturate-125"
				>
					{#if confirming}
						<AlertDialog.Header>
							<AlertDialog.Title class="text-brand-yellow">
								{confirming.kind === "cancel" ? "ยกเลิกการลงทะเบียน?" : "เปลี่ยนรอบเวิร์กช็อป?"}
							</AlertDialog.Title>
							<AlertDialog.Description class="text-brand-mist">
								{#if confirming.kind === "cancel"}
									ยกเลิกรอบ {roundTime(confirming.session)} ของ {workshop.title}
									ที่นั่งจะถูกปล่อยให้ผู้อื่นจองได้
								{:else}
									เปลี่ยนจากรอบ {roundTime(confirming.from)} เป็นรอบ {roundTime(confirming.session)}
								{/if}
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel variant="cta-light" size="cta-sm">ไม่ใช่</AlertDialog.Cancel>
							<AlertDialog.Action variant="cta" size="cta-sm" onclick={confirm}>
								{confirming.kind === "cancel" ? "ยกเลิกการลงทะเบียน" : "เปลี่ยนรอบ"}
							</AlertDialog.Action>
						</AlertDialog.Footer>
					{/if}
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Glass>
	</div>

	<div class="flex flex-col gap-2">
		<Button variant="cta-light" size="cta-lg" href="/myid">ดูเวิร์คช็อปของฉัน</Button>
		<Button variant="cta" size="cta-lg" href="/workshop">ย้อนกลับ</Button>
	</div>
</main>
