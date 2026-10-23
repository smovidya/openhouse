<script lang="ts" module>
	import { attendeeStatusOptions } from "#lib/registration/options.ts";

	const statusLabels = new Map(attendeeStatusOptions.map((option) => [option.value, option.label]));
</script>

<script lang="ts">
	import type { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;

	/** An attendee's name, age and status, as shown in a scanner page's sheet. */
	let { attendee }: { attendee: Attendee } = $props();
</script>

<dl class="flex flex-col gap-1 text-xl">
	{#each [
		["ชื่อ", `${attendee.firstname} ${attendee.lastname}`],
		["อายุ", `${attendee.age} ปี`],
		["สถานะ", statusLabels.get(attendee.type) ?? attendee.type],
	] as [label, value] (label)}
		<div class="flex gap-4">
			<dt class="w-[103px] shrink-0 text-brand-navy">{label}</dt>
			<dd class="min-w-0 flex-1 break-words text-black">{value}</dd>
		</div>
	{/each}
</dl>
