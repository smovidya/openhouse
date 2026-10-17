<script lang="ts" module>
	import addCircleIcon from "#lib/assets/icons/add-circle.svg";
	import cancelRedIcon from "#lib/assets/icons/cancel-red.svg";
	import checkCircleGreenIcon from "#lib/assets/icons/check-circle-green.svg";
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
	import { sessionsByDay, sessionStatus, type WorkshopSession } from "#lib/workshops.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const workshop = $derived(data.workshop);
	let booked = $derived(data.booked);

	function register(session: WorkshopSession) {
		// TODO: book through the backend once it exists; this only updates the page.
		booked = [...booked, session];
	}
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

				{#each sessionsByDay(workshop.sessions) as { day, sessions } (day)}
					<time datetime={day} class="text-xs text-brand-mist">
						{dayFormat.format(new Date(sessions[0].start))}
					</time>
					{#each sessions as session (session.id)}
						{@const status = sessionStatus(session, booked)}
						{@const look = statusLook[status]}
						{@const rowClass = [
							"flex w-full items-start justify-between rounded-lg border px-4 py-2 text-xs",
							look.class,
						]}
						{#snippet row()}
							<span class="flex items-center gap-4 text-brand-mist">
								<span>
									<time datetime={session.start}>{timeFormat.format(new Date(session.start))}</time> -
									<time datetime={session.end}>{timeFormat.format(new Date(session.end))}</time>
								</span>
								<span>จำนวน {session.registered}/{session.capacity}</span>
							</span>
							<span class="flex items-center gap-1">
								{look.label}
								<img src={look.icon} alt="" />
							</span>
						{/snippet}

						{#if status === "available"}
							<button
								type="button"
								class={[
									rowClass,
									"cursor-pointer transition-colors outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-brand-mist/50 active:bg-white/20",
								]}
								onclick={() => register(session)}
							>
								{@render row()}
							</button>
						{:else}
							<div class={rowClass}>{@render row()}</div>
						{/if}
					{/each}
				{/each}
			</section>
		</Glass>
	</div>

	<div class="flex flex-col gap-2">
		<Button variant="cta-light" size="cta-lg" href="/myid">ดูเวิร์คช็อปของฉัน</Button>
		<Button variant="cta" size="cta-lg" href="/workshop">ย้อนกลับ</Button>
	</div>
</main>
