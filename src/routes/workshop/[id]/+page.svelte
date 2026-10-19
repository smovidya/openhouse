<script lang="ts" module>
	import addCircleIcon from "#lib/assets/icons/add-circle.svg";
	import cancelRedIcon from "#lib/assets/icons/cancel-red.svg";
	import checkCircleGreenIcon from "#lib/assets/icons/check-circle-green.svg";
	import type { SessionStatus } from "#lib/workshops.js";

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	const statusLook: Record<SessionStatus, { label: string; icon: string; class: string }> = {
		available: {
			label: "กดเพื่อลงทะเบียน",
			icon: addCircleIcon,
			class: "border-white text-brand-mist",
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
	};
</script>

<script lang="ts">
	import calendarIcon from "#lib/assets/icons/calendar-lg.svg";
	import infoIcon from "#lib/assets/icons/info.svg";
	import Glass from "#lib/components/glass.svelte";
	import SignBoard from "#lib/components/sign-board.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { goto } from "$app/navigation";
	import {
		listWorkshops,
		getWorkshopBySlug,
		getMyWorkshopRegistrations,
		registerForWorkshop,
		unregisterFromWorkshop,
	} from "#lib/features/workshops/workshops.remote.ts";
	import { getTimeGates } from "#lib/features/time/time.remote.ts";
	import {
		getWorkshopRegistrationGateError,
		getWorkshopUnregistrationGateError,
	} from "#lib/constants/time.ts";
	import { MAX_ADVANCE_WORKSHOP_REGISTRATIONS } from "#lib/constants/workshops.ts";
	import {
		sessionStatus,
		toWorkshop,
		workshopErrorMessage,
		type WorkshopSession,
	} from "#lib/workshops.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const details = $derived(getWorkshopBySlug(data.workshopSlug));
	const workshop = $derived(
		details.current?.isOk() && details.current.value ? toWorkshop(details.current.value) : null,
	);
	const registrations = $derived(data.session?.user.attendee ? getMyWorkshopRegistrations() : null);
	const bookings = $derived(registrations?.current?.isOk() ? registrations.current.value : []);
	const booked = $derived(
		bookings.map((booking) => ({
			id: `${booking.workshopSlug}-${booking.workshopRoundNumber}`,
			roundNumber: booking.workshopRoundNumber,
			start: booking.startsAt.toISOString(),
			end: booking.endsAt.toISOString(),
			registered: 0,
			capacity: 0,
		})),
	);
	const gates = getTimeGates();
	let pending = $state(false);
	let rowErrors = $state<Record<string, string>>({});

	function restriction(session: WorkshopSession): string | null {
		if (!workshop) return null;
		const status = sessionStatus(session, booked);
		const clock = gates.current;
		if (clock) {
			const gateError =
				status === "registered"
					? getWorkshopUnregistrationGateError(clock)
					: getWorkshopRegistrationGateError(clock);
			if (gateError) return workshopErrorMessage(gateError);
		}
		if (status === "registered") return null;
		if (status === "full") return workshopErrorMessage("WORKSHOP_FULL");
		if (bookings.some((booking) => booking.workshopSlug === workshop.id))
			return workshopErrorMessage("ALREADY_REGISTERED_FOR_WORKSHOP");
		if (status === "conflict") return workshopErrorMessage("WORKSHOP_TIME_CONFLICT");
		if (
			bookings.filter((booking) => booking.type === "advance").length >=
			MAX_ADVANCE_WORKSHOP_REGISTRATIONS
		)
			return workshopErrorMessage("WORKSHOP_ADVANCE_REGISTRATION_LIMIT_REACHED");
		if (clock && Date.parse(session.start) <= Date.parse(clock.now))
			return workshopErrorMessage("WORKSHOP_ALREADY_STARTED");
		return null;
	}

	async function selectRound(session: WorkshopSession) {
		if (pending || !workshop) return;
		if (!data.session) {
			await goto("/#register");
			return;
		}
		if (!data.session.user.attendee) {
			await goto("/register");
			return;
		}
		const blocked = restriction(session);
		if (blocked) {
			rowErrors[session.id] = blocked;
			return;
		}
		const cancelling = sessionStatus(session, booked) === "registered";
		if (cancelling && !window.confirm("ต้องการยกเลิกการลงทะเบียนรอบนี้หรือไม่?")) return;
		pending = true;
		rowErrors = {};
		try {
			const input = { workshopSlug: workshop.id, workshopRoundNumber: session.roundNumber };
			const result = await (cancelling ? unregisterFromWorkshop(input) : registerForWorkshop(input));
			if (result.isErr()) {
				if (result.error === "ATTENDEE_NOT_FOUND") {
					await goto("/register");
					return;
				}
				rowErrors[session.id] = workshopErrorMessage(result.error);
				await Promise.allSettled([
					listWorkshops().refresh(),
					details.refresh(),
					registrations?.refresh(),
				]);
			}
		} catch {
			rowErrors[session.id] = "ไม่สามารถทำรายการได้ กรุณาลองอีกครั้ง";
			await Promise.allSettled([
				listWorkshops().refresh(),
				details.refresh(),
				registrations?.refresh(),
			]);
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>{workshop?.title ?? "Workshop"} | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col justify-between gap-6 px-3 pt-6 pb-4">
	{#if workshop}
		<div class="flex flex-col items-center gap-6">
			<SignBoard title="WORKSHOP" wide />
			<Glass as="article" class="flex w-full flex-col gap-3 rounded-lg p-3">
				<header class="text-center">
					<h2 class="text-lg font-medium text-brand-yellow">{workshop.title}</h2>
					<p class="text-[10px] text-brand-mist">{workshop.department}</p>
				</header>

				<section>
					<h3 class="flex items-center gap-1 text-sm text-brand-yellow">
						<img src={infoIcon} alt="" />
						รายละเอียดกิจกรรม
					</h3>
					<p class="text-xs text-brand-mist">{workshop.description}</p>
				</section>

				<section class="flex flex-col gap-2">
					<div class="flex items-center gap-2 text-brand-yellow">
						<h3 class="flex items-center gap-1 text-sm">
							<img src={calendarIcon} alt="" />
							รอบกิจกรรม
						</h3>
						<p class="text-xs">(กดที่รอบเวลาว่างเพื่อลงทะเบียน)</p>
					</div>

					{#if gates.error}
						<p role="alert" class="text-xs text-status-red">ไม่สามารถโหลดเวลาลงทะเบียนได้ กรุณาโหลดหน้าใหม่</p>
					{/if}
					{#if registrations?.current?.isErr() || registrations?.error}
						<p role="alert" class="text-xs text-status-red">ไม่สามารถโหลดการลงทะเบียนได้ กรุณาโหลดหน้าใหม่</p>
					{/if}
					{#each workshop.sessions as session (session.id)}
						{@const status = sessionStatus(session, booked)}
						{@const blocked = restriction(session)}
						{@const look = statusLook[status]}
						<button
							type="button"
							class={[
								"flex w-full cursor-pointer flex-wrap items-start justify-between gap-2 rounded-lg border px-4 py-2 text-xs transition-colors outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-brand-mist/50 active:bg-white/20 disabled:cursor-wait disabled:opacity-60",
								blocked && status === "available" ? "border-status-red text-status-red" : look.class,
							]}
							disabled={pending || Boolean(registrations && !registrations.current?.isOk()) || !gates.current}
							aria-busy={pending}
							aria-describedby={rowErrors[session.id] || blocked ? `error-${session.id}` : undefined}
							onclick={() => selectRound(session)}
						>
							<span class="flex flex-wrap items-center gap-4 text-brand-mist">
								<span>
									<time datetime={session.start}>{timeFormat.format(new Date(session.start))}</time> -
									<time datetime={session.end}>{timeFormat.format(new Date(session.end))}</time>
								</span>
								<span>จำนวน {session.registered}/{session.capacity}</span>
							</span>
							<span class="flex items-center gap-1 text-white">
								{blocked && status === "available" ? "ไม่สามารถลงทะเบียนได้" : look.label}
								<img src={blocked && status === "available" ? cancelRedIcon : look.icon} alt="" />
							</span>
						</button>
						{#if status === "registered" && !blocked}
							<p class="text-xs text-brand-mist">กดที่รอบเพื่อยกเลิกการลงทะเบียน</p>
						{/if}
						{#if rowErrors[session.id] || blocked}
							<p id={`error-${session.id}`} role="alert" class="text-xs text-white">{rowErrors[session.id] || blocked}</p>
						{/if}
					{:else}
						<p class="text-xs text-brand-mist">ยังไม่มีรอบเวิร์กช็อป</p>
					{/each}
				</section>
			</Glass>
		</div>

		<div class="flex flex-col gap-2">
			<Button variant="cta-light" size="cta-lg" href="/myid">ดูเวิร์คช็อปของฉัน</Button>
			<Button variant="cta" size="cta-lg" href="/workshop">ย้อนกลับ</Button>
		</div>
	{:else}
		<p role="status" class="text-brand-mist">{details.error || details.current?.isErr() ? "ไม่สามารถโหลดเวิร์กช็อปได้ กรุณาลองอีกครั้ง" : "กำลังโหลดเวิร์กช็อป..."}</p>
	{/if}
</main>
