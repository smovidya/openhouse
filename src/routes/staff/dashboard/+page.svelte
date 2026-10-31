<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query";
	import { goto } from "$app/navigation";
	import { Pause, Play } from "@lucide/svelte";
	import BoothRace from "#lib/components/dashboard/booth-race.svelte";
	import KpiCard from "#lib/components/dashboard/kpi-card.svelte";
	import LiveFeed from "#lib/components/dashboard/live-feed.svelte";
	import WorkshopTable from "#lib/components/dashboard/workshop-table.svelte";
	import VenueMap from "#lib/components/dashboard/venue-map.svelte";
	import SouvenirTiers from "#lib/components/dashboard/souvenir-tiers.svelte";
	import {
		getDashboardFeed,
		getDashboardStats,
		getDashboardSouvenirs,
	} from "#lib/features/dashboard/dashboard.remote.ts";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
	let souvenirsOpen = $state(false);
	const souvenirs = createQuery(() => ({
		queryKey: ["dashboard-souvenirs"],
		enabled: souvenirsOpen,
		queryFn: async () => {
			const query = getDashboardSouvenirs();
			await query.refresh();
			return await query;
		},
		refetchInterval: 10_000,
	}));

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

	// Tabs keep each board within a single viewport (no page scrolling); the
	// play button cycles through them automatically for the projector screen.
	type TabId = "overview" | "map" | "booths" | "workshops" | "hourly";
	const tabs: { id: TabId; label: string }[] = [
		{ id: "overview", label: "ภาพรวม" },
		{ id: "map", label: "แผนผัง" },
		{ id: "booths", label: "สถิติบูธ" },
		{ id: "workshops", label: "เวิร์กชอป" },
		{ id: "hourly", label: "รายชั่วโมง" },
	];
	let activeTab = $state<TabId>("overview");
	let playing = $state(false);

	// While playing, advance to the next tab every 12 seconds. Reading `playing`
	// synchronously keeps this effect alive only while autoplay is on; the tab is
	// read fresh in the callback so manual tab switches don't fight the timer.
	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			const index = tabs.findIndex((t) => t.id === activeTab);
			activeTab = tabs[(index + 1) % tabs.length].id;
		}, 12_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>แดชบอร์ดแอดมิน | Science Chula Openhouse</title>
</svelte:head>

<main
	class="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-3 overflow-hidden p-3 py-4
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
			onclick={() => goto("/staff/dashboard/bento")}
		>
			มุมมอง Bento
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
			onclick={toggleTv}
		>
			{data.tv ? "ออกจากโหมดจอใหญ่" : "โหมดจอใหญ่ (โปรเจกเตอร์)"}
		</Button>
	</header>

	<div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="กลุ่มข้อมูลแดชบอร์ด">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id="tab-{tab.id}"
				aria-selected={activeTab === tab.id}
				aria-controls="tabpanel-dashboard"
				class="rounded-full border px-3 py-1.5 text-sm transition-colors
				{activeTab === tab.id
					? 'border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow'
					: 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}"
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
		<Button
			variant="outline"
			size="sm"
			class="ml-auto border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
			onclick={() => (playing = !playing)}
			aria-pressed={playing}
		>
			{#if playing}
				<Pause class="size-4" />
				หยุดอัตโนมัติ
			{:else}
				<Play class="size-4" />
				เล่นอัตโนมัติ
			{/if}
		</Button>
	</div>

	{#if stats.isLoading}
		<p class="text-sm text-brand-mist">กำลังโหลดข้อมูล…</p>
	{:else if stats.isError || !stats.data}
		<p role="alert" class="text-sm text-brand-yellow">
			โหลดข้อมูลไม่สำเร็จ จะลองอีกครั้งเอง
		</p>
	{:else}
		{@const dashboard = stats.data}
		<div
			role="tabpanel"
			id="tabpanel-dashboard"
			aria-labelledby="tab-{activeTab}"
			class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
		>
			{#if activeTab === "overview"}
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
				<div><SouvenirTiers bind:open={souvenirsOpen} stats={souvenirs.data} error={souvenirs.isError} /></div>
			{:else if activeTab === "map"}
				<VenueMap booths={dashboard.booths} workshops={dashboard.workshops} now={clock} />
			{:else if activeTab === "booths"}
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
			{:else if activeTab === "workshops"}
				<WorkshopTable workshops={dashboard.workshops} now={clock} />
			{:else}
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
		</div>
	{/if}
</main>

<style>
	/* TV mode: scale the whole board up for a projector in the command room. */
	.tv-mode {
		zoom: 1.5;
		max-width: 100vw;
	}
</style>
