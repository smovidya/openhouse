<script lang="ts">
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Label } from "#lib/components/ui/label/index.js";
	import { Picker, type PickerOption } from "#lib/components/ui/picker/index.js";
	import MoveRight from "@lucide/svelte/icons/move-right";

	const attendeeStatuses: PickerOption[] = [
		{ value: "upper-secondary", label: "มัธยมศึกษาตอนปลาย" },
		{ value: "lower-secondary", label: "มัธยมศึกษาตอนต้น" },
		{ value: "parent", label: "ผู้ปกครอง" },
	];

	let attendeeStatus = $state("");
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-sky p-4">
	<h1 class="text-2xl">Components demo</h1>
	<Button variant="cta" size="cta-lg" class="w-full max-w-[378px]"
		>ลงทะเบียน</Button
	>
	<Button variant="cta" size="cta-sm">
		ดูทั้งหมด <MoveRight />
	</Button>
	<div class="flex w-full max-w-[378px] flex-col gap-1">
		<Label for="emergency-contact" class="text-base font-normal text-brand-navy"
			>หมายเลขติดต่อฉุกเฉิน</Label
		>
		<Input id="emergency-contact" type="tel" placeholder="0XXXXXXXXX" />
	</div>
	<div class="flex w-full max-w-[378px] flex-col gap-1">
		<Label for="attendee-status" class="text-base font-normal text-brand-navy"
			>สถานะผู้เข้าร่วมงาน</Label
		>
		<Picker
			id="attendee-status"
			name="attendee-status"
			placeholder="เลือกสถานะ"
			options={attendeeStatuses}
			bind:value={attendeeStatus}
		/>
	</div>
</main>
