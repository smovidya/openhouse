<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query";
	import { goto } from "$app/navigation";
	import BentoTile from "#lib/components/dashboard/bento-tile.svelte";
	import BoothRace from "#lib/components/dashboard/booth-race.svelte";
	import EventStatus from "#lib/components/dashboard/event-status.svelte";
	import HourlyChart from "#lib/components/dashboard/hourly-chart.svelte";
	import KpiCard from "#lib/components/dashboard/kpi-card.svelte";
	import LiveFeed from "#lib/components/dashboard/live-feed.svelte";
	import SouvenirFunnel from "#lib/components/dashboard/souvenir-funnel.svelte";
	import VenueMap from "#lib/components/dashboard/venue-map.svelte";
	import WorkshopGauges from "#lib/components/dashboard/workshop-gauges.svelte";
	import {
		getDashboardFeed,
		getDashboardSouvenirs,
		getDashboardStats,
	} from "#lib/features/dashboard/dashboard.remote.ts";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// Poll the bento queries alone (not the page load). TanStack pauses them
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
	// The souvenir funnel is always visible here, so poll it continuously but
	// slowly: the eligibility CTE scans every attendee row on D1.
	const souvenirs = createQuery(() => ({
		queryKey: ["dashboard-souvenirs"],
		queryFn: async () => {
			const query = getDashboardSouvenirs();
			await query.refresh();
			return await query;
		},
		refetchInterval: 30_000,
	}));

	let clock = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (clock = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const updatedFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: "Asia/Bangkok",
	});
	const hourFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	const peak = $derived(
		(stats.data?.hourly ?? []).reduce<{ hour: string; count: number } | null>(
			(best, entry) => (!best || entry.count > best.count ? entry : best),
			null,
		),
	);
	const currentHourCount = $derived.by(() => {
		for (const entry of stats.data?.hourly ?? []) {
			const start = new Date(entry.hour).getTime();
			if (start <= clock && clock < start + 3_600_000) return entry.count;
		}
		return 0;
	});

	function toggleTv() {
		goto(`/staff/dashboard/bento${data.tv ? "" : "?tv=1"}`);
	}
</script>

<svelte:head>
	<title>ภาพรวมงาน | Science Chula Openhouse</title>
</svelte:head>

<main
	class="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-3 py-6
	{data.tv ? 'tv-mode' : ''}"
>
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-medium text-brand-yellow">ภาพรวมงาน (Bento)</h1>
		<span class="flex items-center gap-2 text-xs text-brand-mist">
			<span class="inline-block size-2 animate-pulse rounded-full bg-emerald-400"></span>
			LIVE
			{#if stats.data}
				· อัปเดต {updatedFormat.format(new Date(stats.data.updatedAt))} น.
			{/if}
		</span>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				class="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
				onclick={() => goto("/staff/dashboard")}
			>
				แดชบอร์ดแอดมิน
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
				onclick={toggleTv}
			>
				{data.tv ? "ออกจากโหมดจอใหญ่" : "โหมดจอใหญ่ (โปรเจกเตอร์)"}
			</Button>
		</div>
	</header>

	{#if stats.isLoading}
		<p class="text-sm text-brand-mist">กำลังโหลดข้อมูล…</p>
	{:else if stats.isError || !stats.data}
		<p role="alert" class="text-sm text-brand-yellow">
			โหลดข้อมูลไม่สำเร็จ จะลองอีกครั้งเอง
		</p>
	{:else}
		{@const dashboard = stats.data}
		<section
			class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12"
			aria-label="ภาพรวมงาน"
		>
			<BentoTile
				class="md:col-span-2 lg:col-span-4 lg:row-span-2"
				eyebrow="ATTENDANCE"
				title="การเข้าร่วมงาน"
			>
				<div class="flex h-full min-h-0 flex-1 flex-col justify-between gap-3">
					<KpiCard label="ผู้ลงทะเบียน" value={dashboard.registered} />
					<KpiCard
						label="ผู้เข้างานจริง"
						value={dashboard.attended}
						denominator={dashboard.registered}
					/>
					<KpiCard label="อยู่ในงานตอนนี้ (30 นาที)" value={dashboard.activeNow} />
				</div>
			</BentoTile>

			<BentoTile class="lg:col-span-4" eyebrow="NOW" title="สถานะงาน">
				<EventStatus now={clock} />
			</BentoTile>

			<BentoTile
				class="lg:col-span-4"
				eyebrow="TOTAL SCANS"
				title="การเช็คอินรวมทุกจุด"
			>
				<div class="flex h-full flex-col justify-between gap-3">
					<p
						class="font-heading text-4xl font-medium text-brand-yellow tabular-nums"
					>
						{dashboard.totalCheckins.toLocaleString("th-TH")}
					</p>
					<div class="flex flex-wrap gap-2 text-xs">
						<span
							class="rounded-full border border-white/20 px-2.5 py-1 text-white/60 tabular-nums"
						>
							ชั่วโมงนี้ {currentHourCount.toLocaleString("th-TH")}
						</span>
						{#if peak && peak.count > 0}
							<span
								class="rounded-full border border-brand-yellow/40 px-2.5 py-1 text-brand-yellow tabular-nums"
							>
								พีค {hourFormat.format(new Date(peak.hour))} น. ·
								{peak.count.toLocaleString("th-TH")}
							</span>
						{/if}
					</div>
				</div>
			</BentoTile>

			<BentoTile
				class="md:col-span-2 lg:col-span-8"
				eyebrow="CHECK-IN PULSE"
				title="การเช็คอินต่อชั่วโมง"
			>
				<HourlyChart hourly={dashboard.hourly} now={clock} />
			</BentoTile>

			<div class="md:col-span-2 lg:col-span-8">
				<VenueMap booths={dashboard.booths} workshops={dashboard.workshops} now={clock} />
			</div>

			<BentoTile class="md:col-span-2 lg:col-span-4" eyebrow="LATEST" title="เช็คอินล่าสุด">
				<div class="min-h-0 flex-1 overflow-y-auto lg:max-h-[32rem]">
					<LiveFeed items={feed.data ?? []} />
				</div>
			</BentoTile>

			<BentoTile
				class="md:col-span-2 lg:col-span-7"
				eyebrow="WORKSHOPS"
				title="เวิร์กชอป"
				description="ที่นั่งรวมทุกรอบ · จองล่วงหน้า · Walk-in"
			>
				<WorkshopGauges workshops={dashboard.workshops} now={clock} />
			</BentoTile>

			<BentoTile
				class="md:col-span-2 lg:col-span-5"
				eyebrow="SOUVENIRS"
				title="ของที่ระลึก"
				description="ผ่านเงื่อนไข · รับรางวัลแล้ว"
			>
				<SouvenirFunnel stats={souvenirs.data} error={souvenirs.isError} />
			</BentoTile>

			<BentoTile
				class="md:col-span-2 lg:col-span-12"
				eyebrow="BOOTH RACE"
				title="สถิติบูธ"
				description="เรียงตามจำนวนเช็คอิน"
			>
				<BoothRace booths={dashboard.booths} />
			</BentoTile>
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
