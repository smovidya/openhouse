<script lang="ts" module>
	export type RegisteredWorkshop = {
		id: string;
		/** The workshop's slug: the card links to its detail page (to cancel or change the round). */
		slug: string;
		type: "advance" | "walk-in";
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
	import { workshopCheckInWindow } from "#lib/workshops.ts";
	import calendarIcon from "#lib/assets/icons/calendar.svg";
	import clockIcon from "#lib/assets/icons/clock.svg";
	import Glass from "#lib/render/glass.svelte";

	let { workshop }: { workshop: RegisteredWorkshop } = $props();

	const start = $derived(new Date(workshop.start));
	const end = $derived(new Date(workshop.end));
	const checkIn = $derived(workshopCheckInWindow(workshop.start, workshop.type));
</script>

<a
	href="/workshop/{workshop.slug}"
	class="block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-brand-navy"
>
	<Glass as="article" class="rounded-lg flex flex-col gap-2 p-3">
		<div class="flex flex-col gap-1">
			<p class="self-start rounded-full bg-brand-mist px-2 py-0.5 text-xs font-medium text-brand-navy">
				{workshop.department}
			</p>
			<h3 class="text-base font-medium text-brand-yellow">{workshop.title}</h3>
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-mist">
				<span class="flex items-center gap-1">
					<img src={calendarIcon} alt="" />
					<time datetime={workshop.start}>{dateFormat.format(start)}</time>
				</span>
				<span class="flex items-center gap-1">
					<img src={clockIcon} alt="" />
					<span>{timeFormat.format(start)} - {timeFormat.format(end)} น.</span>
				</span>
			</div>
		</div>
		<div class="rounded-lg bg-black/20 px-3 py-2 text-xs text-brand-mist">
			<p class="font-medium">
				เช็กอิน{workshop.type === "advance" ? "ล่วงหน้า" : " onsite"}
				{timeFormat.format(new Date(checkIn.opensAt))}–{timeFormat.format(new Date(checkIn.closesAt))} น.
			</p>
			<p>สแกน Check-In ส่วนกลางก่อน แล้วจึงเช็กอินที่จุด Workshop</p>
		</div>
		<p class="line-clamp-3 text-xs text-brand-mist/80">{workshop.description}</p>
	</Glass>
</a>
