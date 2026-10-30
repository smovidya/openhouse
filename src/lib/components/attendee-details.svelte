<script lang="ts">
	import DetailList from "#lib/components/detail-list.svelte";
	import { attendeeStatusLabel } from "#lib/registration/options.ts";
	import type { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;

	/** An attendee's name, age, status and email, as shown in a scanner page's sheet. */
	let { attendee }: { attendee: Attendee } = $props();
</script>

<DetailList
	rows={[
		["ชื่อ", `${attendee.firstname} ${attendee.lastname}`],
		["อายุ", `${attendee.age} ปี`],
		["สถานะ", attendeeStatusLabel(attendee.type)],
		["อีเมล", attendee.email ?? "-"],
	]}
/>
