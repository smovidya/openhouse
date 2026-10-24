<script lang="ts">
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Label } from "#lib/components/ui/label/index.js";
	import { enrollStaff } from "#lib/features/staff/staff.client.ts";
	import Glass from "#lib/render/glass.svelte";
	import { inviteCodeError } from "#lib/staff.js";

	// The inputs' default navy focus outline vanishes on the staff pages' navy tint.
	const inputClass = "focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60";

	// Not asked yet: the backend requires an affiliation, so every staff member gets this one.
	// Department isn't asked either (optional; permissions come from the invite code).
	const STAFF_TYPE = "staff";

	let name = $state("");
	let phone = $state("");
	let code = $state("");
	let pending = $state(false);
	let message = $state("");

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		message = "";
		try {
			await enrollStaff({ name, phone, type: STAFF_TYPE, code });
		} catch (error) {
			message = inviteCodeError(error);
		} finally {
			pending = false;
		}
	}
</script>

<Glass as="form" class="flex w-full flex-col gap-4 rounded-xl p-4" onsubmit={submit}>
	<div class="flex flex-col gap-1">
		<Label for="staff-name" class="text-base font-normal text-brand-mist">ชื่อ-นามสกุล</Label>
		<Input class={inputClass} id="staff-name" bind:value={name} autocomplete="name" required maxlength={200} />
	</div>
	<div class="flex flex-col gap-1">
		<Label for="staff-phone" class="text-base font-normal text-brand-mist">เบอร์โทรศัพท์</Label>
		<Input
			class={inputClass}
			id="staff-phone"
			type="tel"
			bind:value={phone}
			autocomplete="tel"
			placeholder="0XXXXXXXXX"
			required
			maxlength={32}
		/>
	</div>
	<div class="flex flex-col gap-1">
		<Label for="staff-code" class="text-base font-normal text-brand-mist">รหัสเชิญ (ไม่บังคับ)</Label>
		<Input
			class={inputClass}
			id="staff-code"
			bind:value={code}
			autocomplete="off"
			autocapitalize="off"
			spellcheck={false}
			minlength={8}
			maxlength={128}
		/>
		<p class="text-xs text-brand-mist">ยังไม่มีรหัสเชิญ? ลงทะเบียนก่อนได้ แล้วเพิ่มสิทธิ์ภายหลัง</p>
	</div>
	{#if message}
		<p role="alert" class="text-sm text-brand-yellow">{message}</p>
	{/if}
	<Button type="submit" variant="cta" size="cta-lg" class="w-full" disabled={pending}>
		{pending ? "กำลังลงทะเบียน…" : "ลงทะเบียนสตาฟ"}
	</Button>
</Glass>
