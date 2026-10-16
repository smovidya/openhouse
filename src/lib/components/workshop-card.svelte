<script lang="ts" module>
	export type RegisteredWorkshop = {
		id: string;
		title: string;
		department: string;
		description: string;
		/** ISO 8601 with offset, e.g. 2025-10-18T13:30:00+07:00 */
		start: string;
		end: string;
	};

	const dateFormat = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "long",
		timeZone: "Asia/Bangkok",
	});
	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});
</script>

<script lang="ts">
	import calendarIcon from "#lib/assets/icons/calendar.svg";
	import clockIcon from "#lib/assets/icons/clock.svg";
	import Glass from "./glass.svelte";

	let { workshop }: { workshop: RegisteredWorkshop } = $props();

	const start = $derived(new Date(workshop.start));
	const end = $derived(new Date(workshop.end));
</script>

<Glass as="article" class="rounded-lg bg-black/30 flex flex-col gap-1 p-3">
	<div class="flex flex-col">
		<h3 class="text-sm font-medium text-brand-yellow">{workshop.title}</h3>
		<div class="flex items-center gap-2 text-xs text-brand-yellow">
			<span class="flex items-center gap-1">
				<img src={calendarIcon} alt="" />
				<time datetime={workshop.start}>{dateFormat.format(start)}</time>
			</span>
			<span class="flex items-center gap-1">
				<img src={clockIcon} alt="" />
				<span>{timeFormat.format(start)} - {timeFormat.format(end)}</span>
			</span>
		</div>
	</div>
	<p class="text-[10px] text-brand-sky">{workshop.department}</p>
	<p class="line-clamp-4 text-xs text-brand-mist">{workshop.description}</p>
</Glass>
