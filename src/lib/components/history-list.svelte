<script lang="ts" module>
	export type HistoryEntry = {
		id: string;
		firstname: string;
		lastname: string;
		age: number;
		/** The attendee's status (their `type`). */
		type: string;
		/** What happened, e.g. the booth. */
		detail?: string;
		at: Date | null;
	};

	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});
</script>

<script lang="ts">
	import { attendeeStatusLabel } from "#lib/registration/options.ts";

	/**
	 * A staff history list (Figma "ประวัติการรับของรางวัล"): who, their age and status, what happened,
	 * and when. The event spans two days, so the time includes the day.
	 */
	let { entries, empty }: { entries: readonly HistoryEntry[]; empty: string } = $props();
</script>

<ul class="flex flex-col gap-4">
	{#each entries as entry (entry.id)}
		<li class="flex items-center justify-between gap-3 text-base text-brand-mist">
			<div class="min-w-0">
				<p>{entry.firstname} {entry.lastname}</p>
				<p>{entry.age} ปี / {attendeeStatusLabel(entry.type)}</p>
				{#if entry.detail}
					<p>{entry.detail}</p>
				{/if}
			</div>
			{#if entry.at}
				<p class="shrink-0 text-right text-sm">เวลา {timeFormat.format(entry.at)} น.</p>
			{/if}
		</li>
	{:else}
		<li class="text-center text-base text-brand-mist">{empty}</li>
	{/each}
</ul>
