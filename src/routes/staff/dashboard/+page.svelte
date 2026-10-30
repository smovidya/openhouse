<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query";
	import { goto } from "$app/navigation";
	import BoothRace from "#lib/components/dashboard/booth-race.svelte";
	import KpiCard from "#lib/components/dashboard/kpi-card.svelte";
	import LiveFeed from "#lib/components/dashboard/live-feed.svelte";
	import WorkshopTable from "#lib/components/dashboard/workshop-table.svelte";
	import VenueMap from "#lib/components/dashboard/venue-map.svelte";
	import {
		getDashboardFeed,
		getDashboardStats,
	} from "#lib/features/dashboard/dashboard.remote.ts";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// Poll the dashboard queries alone (not the page load). TanStack pauses them
	// in background tabs, refetches on focus, and keeps the last data if a poll fails.
	const stats = createQuery(() => ({
		queryKey: ["dashboard-stats"],
		queryFn: async () => {
			// A fresh request: awaiting the query alone can return its cached value.
			const query = getDashboardStats();
			await query.refresh();
			return await query;
		},
		refetchInterval: 10_000,
	}));
	const feed = createQuery(() => ({
		queryKey: ["dashboard-feed"],
		queryFn: async () => {
			const query = getDashboardFeed();
			await query.refresh();
			return await query;
		},
		refetchInterval: 5_000,
	}));

	let clock = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (clock = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});
	const updatedFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	const hourlyMax = $derived(
		Math.max(1, ...(stats.data?.hourly ?? []).map((hour) => hour.count)),
	);

	const attendanceRate = $derived(
		stats.data && stats.data.registered > 0
			? (stats.data.attended / stats.data.registered) * 100
			: 0,
	);

	function toggleTv() {
		goto(`/staff/dashboard${data.tv ? "" : "?tv=1"}`);
	}
</script>

<svelte:head>
	<title>แดชบอร์ดแอดมิน | Science Chula Openhouse</title>
</svelte:head>

<main
	class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-3 py-6
	{data.tv ? 'tv-mode' : ''}"
>
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-medium text-brand-yellow">แดชบอร์ดแอดมิน</h1>
		<span class="flex items-center gap-2 text-xs text-brand-mist">
			<span class="inline-block size-2 animate-pulse rounded-full bg-emerald-400"></span>
			LIVE
			{#if stats.data}
				· อัปเดต {updatedFormat.format(new Date(stats.data.updatedAt))} น.
			{/if}
		</span>
		<Button
			variant="outline"
			size="sm"
			class="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
			onclick={toggleTv}
		>
			{data.tv ? "ออกจากโหมดจอใหญ่" : "โหมดจอใหญ่ (โปรเจกเตอร์)"}
		</Button>
	</header>

	{#if stats.isLoading}
		<p class="text-sm text-brand-mist">กำลังโหลดข้อมูล…</p>
	{:else if stats.isError || !stats.data}
		<p role="alert" class="text-sm text-brand-yellow">
			โหลดข้อมูลไม่สำเร็จ จะลองอีกครั้งเอง
		</p>
	{:else}
		{@const dashboard = stats.data}
		<section class="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="ภาพรวม">
			<KpiCard label="ผู้ลงทะเบียน" value={dashboard.registered} />
			<KpiCard
				label="ผู้เข้างานจริง"
				value={dashboard.attended}
				denominator={dashboard.registered}
			/>
			<KpiCard label="อยู่ในงานตอนนี้ (30 นาที)" value={dashboard.activeNow} />
			<KpiCard label="การเช็คอินรวมทุกจุด" value={dashboard.totalCheckins} />
		</section>

		<p class="text-xs text-brand-mist">
			อัตราผู้เข้างานจริง {attendanceRate.toFixed(1)}%
		</p>
		<VenueMap booths={dashboard.booths} workshops={dashboard.workshops} now={clock} />

		<div class="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<section class="rounded-xl border border-white/10 bg-white/5 p-4" aria-label="สถิติบูธ">
				<h2 class="mb-3 text-lg font-medium text-brand-yellow">
					สถิติบูธ (เรียงตามจำนวนเช็คอิน)
				</h2>
				<BoothRace booths={dashboard.booths} />
			</section>
			<section class="rounded-xl border border-white/10 bg-white/5 p-4" aria-label="เช็คอินล่าสุด">
				<h2 class="mb-3 text-lg font-medium text-brand-yellow">เช็คอินล่าสุด</h2>
				<LiveFeed items={feed.data ?? []} />
			</section>
		</div>

		<WorkshopTable workshops={dashboard.workshops} now={clock} />

		<section class="rounded-xl border border-white/10 bg-white/5 p-4" aria-label="เช็คอินต่อชั่วโมง">
			<h2 class="mb-3 text-lg font-medium text-brand-yellow">การเช็คอินต่อชั่วโมง</h2>
			<div class="flex items-end justify-between gap-1 overflow-x-auto" style="height: 120px;">
				{#each dashboard.hourly as hour (hour.hour)}
					{@const isCurrentHour = new Date(hour.hour).getTime() <= clock
						&& clock < new Date(new Date(hour.hour).getTime() + 3_600_000).getTime()}
					<div class="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-1">
						<span class="text-[10px] text-brand-mist tabular-nums">{hour.count}</span>
						<div
							class="w-full rounded-t
							{isCurrentHour ? 'animate-pulse bg-brand-yellow' : 'bg-brand-mist/60'} transition-all duration-600"
							style="height: {Math.max(
								(hour.count / hourlyMax) * 80,
								hour.count > 0 ? 6 : 2,
							)}px;"
						></div>
						<span class="text-[10px] text-brand-mist tabular-nums">
							{timeFormat.format(new Date(hour.hour))} น.
						</span>
					</div>
				{:else}
					<p class="text-sm text-brand-mist">ยังไม่มีข้อมูล</p>
				{/each}
			</div>
		</section>
	{/if}
</main>

<style>
	/* TV mode: scale the whole board up for a projector in the command room. */
	.tv-mode {
		zoom: 1.5;
		max-width: 100vw;
	}
</style>
