<script lang="ts">
	import { flip } from "svelte/animate";
	import type { DashboardFeedItem } from "#lib/features/dashboard/types.ts";

	let { items }: { items: DashboardFeedItem[] } = $props();

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: "Asia/Bangkok",
	});

	// A ticking clock re-renders ages and expires the new-entry highlight.
	let clock = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (clock = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	// Non-reactive memory of when each row first appeared: new ids stay
	// highlighted for 5 seconds, then the tint fades out.
	const firstSeen = new Map<string, number>();
	const freshIds = $derived.by(() => {
		void clock;
		for (const item of items) {
			if (!firstSeen.has(item.id)) firstSeen.set(item.id, clock);
		}
		const fresh = new Set<string>();
		for (const [id, seen] of firstSeen) {
			if (clock - seen < 5000) fresh.add(id);
		}
		return fresh;
	});

	function timeAgo(iso: string) {
		void clock;
		const seconds = Math.max(0, (clock - Date.parse(iso)) / 1000);
		if (seconds < 60) return "เมื่อสักครู่";
		return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
	}
</script>

<ol class="flex flex-col gap-1.5">
	{#each items.slice().reverse() as item (item.id)}
		{@const checkpointLabel = item.checkpointName ?? item.checkpointType}
		<li
			class="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm
			{freshIds.has(item.id) ? 'bg-brand-yellow/15' : ''} transition-colors duration-1000"
			animate:flip={{ duration: 300 }}
		>
			<span class="flex min-w-0 items-center gap-2">
				<span
					class="inline-block size-1.5 shrink-0 rounded-full
					{freshIds.has(item.id) ? 'animate-pulse bg-brand-yellow' : 'bg-white/30'}"
				></span>
				<span class="truncate text-white">
					{item.firstname} {item.lastnameInitial}
				</span>
				<span class="truncate text-xs text-white/60">เช็คอิน {checkpointLabel}</span>
			</span>
			<time
				datetime={item.createdAt}
				class="shrink-0 text-xs text-white/50 tabular-nums"
				title={new Date(item.createdAt).toLocaleString("th-TH")}
			>
				{timeFormat.format(new Date(item.createdAt))}
			</time>
		</li>
	{/each}
	{#if items.length === 0}
		<li class="text-sm text-brand-mist">ยังไม่มีการเช็คอิน</li>
	{/if}
</ol>