<script lang="ts">
	import * as Collapsible from "#lib/components/ui/collapsible/index.js";
	import * as Select from "#lib/components/ui/select/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { ChevronDown } from "@lucide/svelte";
	import { SvelteSet } from "svelte/reactivity";
	import RoundAttendees from "#lib/components/dashboard/round-attendees.svelte";
	import type { WorkshopStats } from "#lib/features/dashboard/types.ts";

	let { workshops, now }: { workshops: WorkshopStats[]; now: number } = $props();

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	function roundStatus(round: {
		startsAt: string;
		endsAt: string;
		capacity: number;
		advance: number;
		walkIn: number;
	}) {
		const start = Date.parse(round.startsAt);
		const end = Date.parse(round.endsAt);
		if (now < start - 15 * 60 * 1000) return "จองได้";
		if (now >= end) return "จบแล้ว";
		if (now >= start) return "กำลังจัด";
		return "ใกล้เริ่ม";
	}

	const statusStyles: Record<string, string> = {
		"จองได้": "border-emerald-400/40 text-emerald-300",
		"ใกล้เริ่ม": "border-amber-400/40 text-amber-300",
		"กำลังจัด": "border-sky-400/40 text-sky-300",
		"จบแล้ว": "border-white/20 text-white/40",
	};

	/** Client-side text search across title, department, abbr, and round status. */
	let search = $state("");
	const normalizedSearch = $derived(
		search
			.trim()
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean),
	);

	/** Client-side status filter (all / upcoming / running / ended / full rounds). */
	let statusFilter = $state<"all" | "upcoming" | "running" | "ended" | "full">(
		"all",
	);

	function matchesSearch(workshop: WorkshopStats) {
		if (!normalizedSearch.length) return true;
		const haystack = [
			workshop.title,
			workshop.hostDepartment,
			workshop.hostDepartmentAbbr,
		]
			.join(" ")
			.toLowerCase();
		return normalizedSearch.every((token) => haystack.includes(token));
	}

	const statusFilters = {
		upcoming: "จองได้",
		running: "กำลังจัด",
		ended: "จบแล้ว",
	} as const;

	function matchesFilter(round: WorkshopStats["rounds"][number]) {
		if (statusFilter === "all") return true;
		if (statusFilter === "full")
			return (
				round.capacity > 0 && round.advance + round.walkIn >= round.capacity
			);
		return roundStatus(round) === statusFilters[statusFilter];
	}

	/** Filtered view: workshops with rounds matching both filters (or none at all). */
	const filtered = $derived(
		workshops
			.filter(matchesSearch)
			.map((workshop) => ({
				...workshop,
				rounds: workshop.rounds.filter(matchesFilter),
			}))
			.filter((workshop) => workshop.rounds.length > 0 || statusFilter === "all"),
	);

	const totalRounds = $derived(
		filtered.reduce((sum, workshop) => sum + workshop.rounds.length, 0),
	);

	// Keep the collapsed state per workshop slug (survives filtering); the
	// Collapsible triggers update it via the isOpen binding below.
	const collapsed = new SvelteSet<string>();
	function setAll(open: boolean) {
		collapsed.clear();
		if (!open) for (const workshop of filtered) collapsed.add(workshop.slug);
	}

	const allOpen = $derived(
		filtered.every((workshop) => !collapsed.has(workshop.slug)),
	);
</script>

<section class="flex flex-col gap-3" aria-label="ภาพรวมเวิร์คช็อป">
	<div class="flex flex-wrap items-center gap-2">
		<Input
			type="search"
			placeholder="ค้นหาชื่อเวิร์คช็อปหรือภาควิชา…"
			bind:value={search}
			class="h-9 max-w-64 flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60"
		/>
		<Select.Root type="single" bind:value={statusFilter}>
			<Select.Trigger
				class="h-9 w-40 border-white/20 bg-transparent text-white data-placeholder:text-white/40 dark:bg-transparent dark:hover:bg-white/10"
			/>
			<Select.Content class="border-white/10 bg-brand-mist text-brand-navy">
				<Select.Item value="all" class="cursor-pointer">ทุกสถานะ</Select.Item>
				<Select.Item value="upcoming" class="cursor-pointer">จองได้</Select.Item>
				<Select.Item value="running" class="cursor-pointer">กำลังจัด</Select.Item>
				<Select.Item value="ended" class="cursor-pointer">จบแล้ว</Select.Item>
				<Select.Item value="full" class="cursor-pointer">รอบที่เต็ม</Select.Item>
			</Select.Content>
		</Select.Root>
		<span class="ml-auto text-xs text-brand-mist tabular-nums">
			{filtered.length} เวิร์คช็อป · {totalRounds} รอบ
		</span>
		<Button
			variant="outline"
			size="sm"
			class="h-9 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
			onclick={() => setAll(!allOpen)}
		>
			{allOpen ? "ย่อทั้งหมด" : "ขยายทั้งหมด"}
		</Button>
	</div>

	{#each filtered as workshop (workshop.slug)}
		{@const isOpen = !collapsed.has(workshop.slug)}
		{@const totalRegistered = workshop.rounds.reduce(
			(sum, round) => sum + round.advance + round.walkIn,
			0,
		)}
		{@const totalCapacity = workshop.rounds.reduce(
			(sum, round) => sum + round.capacity,
			0,
		)}
		{@const totalAttended = workshop.rounds.reduce(
			(sum, round) => sum + round.attended,
			0,
		)}
		<Collapsible.Root
			class="overflow-hidden rounded-xl border border-white/10"
			open={isOpen}
			onOpenChange={(open) => {
				if (open) collapsed.delete(workshop.slug);
				else collapsed.add(workshop.slug);
			}}
		>
			<Collapsible.Trigger
				class="flex w-full items-center gap-3 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-brand-yellow/60"
				aria-label="{workshop.title} ({isOpen ? 'ย่อ' : 'ขยาย'})"
			>
				<span
					class="inline-block size-4 shrink-0 text-brand-mist transition-transform duration-200 {isOpen ? 'rotate-90' : ''}"
				>
					<ChevronDown class="size-4" />
				</span>
				<span class="min-w-0 flex-1">
					<span class="block truncate font-medium text-white">{workshop.title}</span>
					<span class="block truncate text-xs text-white/50">
						{workshop.hostDepartment} ({workshop.hostDepartmentAbbr})
					</span>
				</span>
				<span class="shrink-0 text-xs text-brand-mist tabular-nums">
					{workshop.rounds.length} รอบ · {totalRegistered}
					{totalCapacity > 0 ? `/${totalCapacity}` : ""} ที่นั่ง
					· <span class="text-emerald-300">มาแล้ว {totalAttended}</span>
				</span>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-sm">
						<thead>
							<tr
								class="bg-white/5 text-left text-xs tracking-wide text-white/60 uppercase"
							>
								<th class="px-4 py-2 font-medium">รอบ</th>
								<th class="px-4 py-2 font-medium">เวลา</th>
								<th class="px-4 py-2 text-right font-medium">ความจุ</th>
								<th class="px-4 py-2 text-right font-medium">จองล่วงหน้า</th>
								<th class="px-4 py-2 text-right font-medium">Walk-in</th>
								<th class="px-4 py-2 text-right font-medium">รวม</th>
								<th class="px-4 py-2 text-right font-medium">มาแล้ว</th>
								<th class="w-40 px-4 py-2 font-medium">ความจุที่ใช้</th>
								<th class="px-4 py-2 font-medium">สถานะ</th>
							</tr>
						</thead>
						<tbody>
						{#each workshop.rounds as round (round.roundNumber)}
							{@const registered = round.advance + round.walkIn}
							{@const status = roundStatus(round)}
							{@const fill = round.capacity > 0
								? Math.min((registered / round.capacity) * 100, 100)
								: 0}
							{@const full = registered >= round.capacity && round.capacity > 0}
							{@const current = status === "กำลังจัด"}
							<tr
								class="border-t border-white/10 transition-colors hover:bg-white/5
								{full ? 'bg-brand-yellow/10' : ''}
								{current ? 'bg-sky-400/10 ring-1 ring-sky-300/30 ring-inset' : ''}"
							>
								<td class="px-4 py-2 text-white/70 tabular-nums">{round.roundNumber}</td>
								<td class="px-4 py-2 text-white/70 tabular-nums whitespace-nowrap">
									{timeFormat.format(new Date(round.startsAt))}–{timeFormat.format(
										new Date(round.endsAt),
									)} น.
								</td>
								<td class="px-4 py-2 text-right text-white/70 tabular-nums">{round.capacity}</td>
								<td class="px-4 py-2 text-right text-sky-300 tabular-nums">{round.advance}</td>
								<td class="px-4 py-2 text-right text-amber-300 tabular-nums">{round.walkIn}</td>
								<td class="px-4 py-2 text-right font-medium text-white tabular-nums">
									{registered}{#if full} <span class="text-brand-yellow">(เต็ม)</span>{/if}
								</td>
								<td class="px-4 py-2 text-right text-emerald-300 tabular-nums">
									{round.attended}
								</td>
								<td class="px-4 py-2">
									<div class="h-2 w-full overflow-hidden rounded-full bg-white/10">
										<div
											class="h-full rounded-full {full
												? 'bg-red-400'
												: 'bg-brand-yellow'} transition-all duration-600"
											style="width: {fill}%"
										></div>
									</div>
									<p class="mt-1 text-[10px] text-white/50 tabular-nums">
										{fill.toFixed(0)}%
									</p>
								</td>
								<td class="px-4 py-2">
									<span
										class="rounded-full border px-2 py-0.5 text-xs whitespace-nowrap {statusStyles[status]}"
									>
										{status}
									</span>
								</td>
							</tr>
							<RoundAttendees {round} workshopTitle={workshop.title} />
						{:else}
							<tr class="border-t border-white/10 bg-white/[0.02]">
								<td class="px-4 py-3 text-xs text-white/60" colspan="9">
									ไม่มีรอบที่ตรงกับตัวกรอง
								</td>
							</tr>
						{/each}
						{#if true}
							<!-- Summary of all rounds for this workshop. -->
							{@const sumAdvance = workshop.rounds.reduce(
								(sum, round) => sum + round.advance,
								0,
							)}
							{@const sumWalkIn = workshop.rounds.reduce(
								(sum, round) => sum + round.walkIn,
								0,
							)}
							{@const sumCapacity = workshop.rounds.reduce(
								(sum, round) => sum + round.capacity,
								0,
							)}
							{@const sumRegistered = sumAdvance + sumWalkIn}
							{@const sumAttended = workshop.rounds.reduce(
								(sum, round) => sum + round.attended,
								0,
							)}
							{@const sumFill = sumCapacity > 0
								? Math.min((sumRegistered / sumCapacity) * 100, 100)
								: 0}
							{@const avgPerRound = workshop.rounds.length > 0
								? (sumRegistered / workshop.rounds.length).toFixed(1)
								: "0"}
							<tr class="border-t-2 border-white/20 bg-white/10 text-xs">
								<td class="px-4 py-2 font-medium text-white">รวมทุกรอบ</td>
								<td class="px-4 py-2 text-white/60 tabular-nums">
									{workshop.rounds.length} รอบ
								</td>
								<td class="px-4 py-2 text-right text-white/60 tabular-nums">{sumCapacity}</td>
								<td class="px-4 py-2 text-right text-sky-300 tabular-nums">{sumAdvance}</td>
								<td class="px-4 py-2 text-right text-amber-300 tabular-nums">{sumWalkIn}</td>
								<td class="px-4 py-2 text-right font-medium text-white tabular-nums">
									{sumRegistered}
								</td>
								<td class="px-4 py-2 text-right text-emerald-300 tabular-nums">
									{sumAttended}
								</td>
								<td class="px-4 py-2">
									<div class="h-2 w-full overflow-hidden rounded-full bg-white/10">
										<div
											class="h-full rounded-full bg-brand-yellow transition-all duration-600"
											style="width: {sumFill}%"
										></div>
									</div>
									<p class="mt-1 text-[10px] text-white/50 tabular-nums">
										{sumFill.toFixed(0)}%
									</p>
								</td>
								<td class="px-4 py-2 text-white/60 tabular-nums">เฉลี่ย {avgPerRound} คน/รอบ</td>
							</tr>
						{/if}
					</tbody>
					</table>
				</div>
			</Collapsible.Content>
		</Collapsible.Root>
	{:else}
		<p class="text-sm text-brand-mist">ไม่พบเวิร์คช็อปที่ตรงกับการค้นหา</p>
	{/each}
</section>