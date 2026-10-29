<script lang="ts" module>
	import { attendeeStatusOptions } from "#lib/registration/options.ts";

	const statusLabels = new Map(attendeeStatusOptions.map((option) => [option.value, option.label]));
</script>

<script lang="ts">
	import DetailList from "#lib/components/detail-list.svelte";
	import type { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { mockAttendeeEmail } from "#lib/mock/attendees.js";

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;

	/** An attendee's name, age, status and email, as shown in a scanner page's sheet. */
	let { attendee }: { attendee: Attendee } = $props();
</script>

<DetailList
	rows={[
		["ชื่อ", `${attendee.firstname} ${attendee.lastname}`],
		["อายุ", `${attendee.age} ปี`],
		["สถานะ", statusLabels.get(attendee.type) ?? attendee.type],
		["อีเมล", mockAttendeeEmail(attendee)],
	]}
/>
