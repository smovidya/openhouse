<script lang="ts">
	import { refreshAll } from "$app/navigation";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Label } from "#lib/components/ui/label/index.js";
	import { redeemInviteCode } from "#lib/features/staff/staff.remote.ts";
	import type { StaffPermission } from "#lib/features/staff/permissions.ts";
	import Glass from "#lib/render/glass.svelte";
	import { inviteCodeError } from "#lib/staff.js";

	// The inputs' default navy focus outline vanishes on the staff pages' navy tint.
	const inputClass = "focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60";

	/** The staff member's current permissions; each code adds its own (they never shrink). */
	let { permissions }: { permissions: StaffPermission[] } = $props();

	let code = $state("");
	let pending = $state(false);
	let message = $state("");
	let failed = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		message = "";
		try {
			await redeemInviteCode({ code });
			// The session has the merged permissions now.
			await refreshAll();
			code = "";
			failed = false;
			message = "เพิ่มสิทธิ์แล้ว";
		} catch (error) {
			failed = true;
			message = inviteCodeError(error);
		} finally {
			pending = false;
		}
	}
</script>

<Glass as="form" class="flex w-full flex-col gap-2 rounded-xl p-4" onsubmit={submit}>
	<Label for="staff-more-code" class="text-base font-normal text-brand-mist">
		เพิ่มสิทธิ์ด้วยรหัสเชิญ
	</Label>
	<div class="flex gap-2">
		<Input
			class={inputClass}
			id="staff-more-code"
			bind:value={code}
			autocomplete="off"
			autocapitalize="off"
			spellcheck={false}
			required
			minlength={8}
			maxlength={128}
		/>
		<Button type="submit" variant="cta" size="cta-sm" class="shrink-0" disabled={pending}>
			{pending ? "กำลังเพิ่ม…" : "เพิ่มสิทธิ์"}
		</Button>
	</div>
	{#if message}
		<p role={failed ? "alert" : "status"} class="text-sm text-brand-yellow">{message}</p>
	{/if}
	<p class="text-xs text-brand-mist">สิทธิ์ปัจจุบัน: {permissions.join(", ")}</p>
</Glass>
