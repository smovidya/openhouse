<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query";
	import { ChevronRight, CircleCheck } from "@lucide/svelte";
	import { SvelteSet } from "svelte/reactivity";
	import { getWorkshopRoundAttendees } from "#lib/features/dashboard/dashboard.remote.ts";
	import type { WorkshopRoundStats } from "#lib/features/dashboard/types.ts";

	let {
		round,
		workshopTitle,
	}: { round: WorkshopRoundStats; workshopTitle: string } = $props();

	// Attendee names load on demand only when this round is expanded. A single
	// boolean would lose the value on re-render; a SvelteSet keeps it stable.
	const expanded = new SvelteSet<string>();

	const attendees = createQuery(() => ({
		queryKey: ["workshop-round-attendees", round.slotId],
		queryFn: async () => {
			const query = getWorkshopRoundAttendees(round.slotId);
			await query.refresh();
			return await query;
		},
		enabled: expanded.size > 0,
		staleTime: 60_000,
	}));

	const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		day: "numeric",
		month: "short",
		timeZone: "Asia/Bangkok",
	});
</script>

{#snippet row(attendee: NonNullable<typeof attendees.data>[number])}
	<div class="flex items-center justify-between gap-3 px-3 py-1">
		<span class="flex min-w-0 items-center gap-2">
			<span
				class="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium
				{attendee.type === "advance" ? "bg-sky-400/20 text-sky-300" : "bg-amber-400/20 text-amber-300"}"
				title={attendee.type === "advance" ? "จองล่วงหน้า" : "Walk-in"}
			>
				{attendee.type === "advance" ? "A" : "W"}
			</span>
			<span class="truncate text-sm text-white">
				{attendee.firstname} {attendee.lastname}
			</span>
			{#if attendee.school}
				<span class="truncate text-xs text-white/50">{attendee.school}</span>
			{/if}
		</span>
		<span class="flex shrink-0 items-center gap-2">
			{#if attendee.checkedIn}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
					title="เช็คอินเข้ารอบนี้แล้ว"
				>
					<CircleCheck class="size-3" />
					มาแล้ว
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40"
					title="ยังไม่เช็คอินเข้ารอบนี้"
				>
					ยังไม่มา
				</span>
			{/if}
			<time
				datetime={attendee.registeredAt}
				class="text-xs text-white/50 tabular-nums"
			>
				{dateTimeFormat.format(new Date(attendee.registeredAt))} น.
			</time>
		</span>
	</div>
{/snippet}

<tr class="border-t border-white/10 bg-white/[0.02]">
	<td colspan="8" class="p-0">
		<button
			type="button"
			class="flex w-full items-center gap-1 px-4 py-1.5 text-left text-xs text-brand-mist transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-brand-yellow/60 outline-none"
			aria-expanded={expanded.size > 0}
			onclick={() => {
				if (expanded.size > 0) expanded.clear();
				else expanded.add(round.slotId);
			}}
		>
			<span class="flex items-center gap-1">
				<span
					class="inline-block transition-transform duration-200 {expanded.size > 0
						? "rotate-90"
						: ""}"
				>
					<ChevronRight class="size-3" />
				</span>
				รายชื่อผู้ลงทะเบียนรอบ {round.roundNumber} ของ {workshopTitle}
			</span>
			<span
				class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 tabular-nums"
				title="ผู้ที่เช็คอินเข้ารอบนี้แล้ว (รวม walk-in ที่เพิ่มหน้างาน)"
			>
				มาแล้ว {round.attended}
			</span>
		</button>
		{#if expanded.size > 0}
			<div class="flex flex-col gap-0.5 pb-2" role="list">
				{#if attendees.isLoading}
					<p class="px-4 py-2 text-xs text-white/50">กำลังโหลดรายชื่อ…</p>
				{:else if attendees.isError || !attendees.data}
					<p role="alert" class="px-4 py-2 text-xs text-brand-yellow">
						โหลดรายชื่อไม่สำเร็จ
					</p>
				{:else if attendees.data.length === 0}
					<p class="px-4 py-2 text-xs text-white/50">ยังไม่มีผู้ลงทะเบียน</p>
				{:else}
					{#each attendees.data as attendee (attendee.id)}
						{@render row(attendee)}
					{/each}
				{/if}
			</div>
		{/if}
	</td>
</tr>