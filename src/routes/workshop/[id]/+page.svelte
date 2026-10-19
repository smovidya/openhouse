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
		// One round per workshop: the attendee holds another round of this one. No swapping (it
		// wouldn't be atomic): they cancel that round first, then pick this one.
		"other-round": {
			label: "ยกเลิกรอบเดิมก่อน",
			icon: cancelRedIcon,
			class: "border-brand-sky text-brand-navy",
		},
		// Time and limit states (BookingWindow): shown as they are, not pressable.
		closed: {
			label: "ปิดรับลงทะเบียนแล้ว",
			icon: cancelRedIcon,
			class: "border-brand-sky text-brand-navy",
		},
		started: {
			label: "เริ่มไปแล้ว",
			icon: cancelRedIcon,
			class: "border-brand-sky text-brand-navy",
		},
		limit: {
			label: `ครบ ${MAX_ADVANCE_WORKSHOP_REGISTRATIONS} เวิร์กช็อปแล้ว`,
			icon: cancelRedIcon,
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
	import { createQuery, useQueryClient } from "@tanstack/svelte-query";
	import {
		getWorkshopBySlug,
		registerForWorkshop,
		unregisterFromWorkshop,
	} from "#lib/features/workshops/workshops.remote.ts";
	import {
		canCancel,
		sessionsByDay,
		sessionStatus,
		type BookingWindow,
		type WorkshopSession,
	} from "#lib/workshops.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const workshop = $derived(data.workshop);
	const canBook = $derived(data.attendee === "registered");

	// The server's clock from the load, kept running here (every 30 s) so a round that starts while
	// the page is open turns "started". Re-seeded whenever the page data reloads; it never runs
	// behind the server's time.
	const loaded = $derived({ server: Date.parse(data.now), local: Date.now() });
	let clock = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (clock = Date.now()), 30_000);
		return () => clearInterval(timer);
	});
	const bookingWindow: BookingWindow = $derived({
		now: loaded.server + Math.max(0, clock - loaded.local),
		closed: data.registrationClosed,
		advanceLeft: data.advanceLeft,
	});

	/** The session being changed and what is happening to it, while the request runs. */
	let pending = $state<{ id: string; label: string } | null>(null);
	let message = $state("");

	/** A cancel waiting for the attendee to confirm. */
	let confirming = $state<WorkshopSession | null>(null);

	// Seats fill as others book: poll the seat counts alone (not the whole page load) every 15 s.
	// TanStack pauses it in background tabs, refetches on focus, and keeps the last counts if a
	// poll fails. The rows overlay them on the server load's counts.
	const queryClient = useQueryClient();
	const seatsKey = $derived(["workshop-seats", data.workshop.id]);
	const seats = createQuery(() => ({
		queryKey: seatsKey,
		queryFn: async () => {
			const query = getWorkshopBySlug(data.workshop.id);
			// A fresh request: awaiting the query alone can return its cached value.
			await query.refresh();
			const result = await query;
			if (result.isErr() || !result.value) throw new Error("FETCH_WORKSHOP_FAILED");
			return new Map(result.value.timeSlots.map((slot) => [slot.roundNumber, slot.registeredCount]));
		},
		refetchInterval: 15_000,
	}));
	const liveSessions = $derived(
		workshop.sessions.map((session) => ({
			...session,
			registered: seats.data?.get(session.round) ?? session.registered,
		})),
	);

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
			// The attendee's bookings come from the server load. Refetching the seats cancels a poll
			// in flight, so a response from before the booking can't overwrite the new count.
			await Promise.all([refreshAll(), queryClient.refetchQueries({ queryKey: seatsKey })]);
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

	function press(session: WorkshopSession, status: SessionStatus) {
		if (status === "available") return register(session);
		if (status === "registered") confirming = session;
	}

	function confirm() {
		if (confirming) cancel(confirming);
		confirming = null;
	}

	/** Rows that do something when pressed: book an open round, or cancel your own while you still can. */
	const pressable = (session: WorkshopSession, status: SessionStatus) =>
		status === "available" || (status === "registered" && canCancel(session, bookingWindow));
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
					{#if !data.registrationClosed}
						<p class="text-xs">(กดที่รอบเวลาว่างเพื่อลงทะเบียน)</p>
					{/if}
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

				{#each sessionsByDay(liveSessions) as { day, sessions } (day)}
					<time datetime={day} class="text-xs text-brand-mist">
						{dayFormat.format(new Date(sessions[0].start))}
					</time>
					{#each sessions as session (session.id)}
						{@const status = sessionStatus(session, data.booked, bookingWindow)}
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

						{#if pressable(session, status) && canBook}
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
							<AlertDialog.Title class="text-brand-yellow">ยกเลิกการลงทะเบียน?</AlertDialog.Title>
							<AlertDialog.Description class="text-brand-mist">
								ยกเลิกรอบ {roundTime(confirming)} ของ {workshop.title}
								ที่นั่งจะถูกปล่อยให้ผู้อื่นจองได้
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel variant="cta-light" size="cta-sm">ไม่ใช่</AlertDialog.Cancel>
							<AlertDialog.Action variant="cta" size="cta-sm" onclick={confirm}>
								ยกเลิกการลงทะเบียน
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
