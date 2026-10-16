<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { defaults, superForm } from "sveltekit-superforms";
	import { zod4 } from "sveltekit-superforms/adapters";
	import SignBoard from "#lib/components/sign-board.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Checkbox } from "#lib/components/ui/checkbox/index.js";
	import * as Form from "#lib/components/ui/form/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { MultiPicker, Picker } from "#lib/components/ui/picker/index.js";
	import { Separator } from "#lib/components/ui/separator/index.js";
	import {
		attendeeStatusOptions,
		majorOptions,
		newsSourceOptions,
		nonStudentStatuses,
		prefixOptions,
		visitIntentOptions,
	} from "#lib/registration/options.js";
	import { registrationInfoSchema, registrationSchema } from "#lib/registration/schema.js";

	type TextField =
		| "prefixOther"
		| "firstName"
		| "lastName"
		| "province"
		| "emergencyPhone"
		| "emergencyName"
		| "specialNeeds"
		| "reason"
		| "expectation"
		| "schoolName";
	type MajorField = "major1" | "major2" | "major3";

	const majorFields: MajorField[] = ["major1", "major2", "major3"];
	const infoValidator = zod4(registrationInfoSchema);

	type Step = "info" | "pdpa";

	const step: Step = $derived(page.url.searchParams.get("step") === "pdpa" ? "pdpa" : "info");

	function setStep(next: Step) {
		const url = new URL(page.url.href);
		if (next === "info") url.searchParams.delete("step");
		else url.searchParams.set("step", next);
		goto(url);
	}

	const form = superForm(defaults(zod4(registrationSchema)), {
		SPA: true,
		dataType: "json",
		resetForm: false,
		validators: zod4(registrationSchema),
		onUpdate({ form }) {
			if (!form.valid) {
				// Only PDPA lives on this step; any other error means step 1 needs fixing.
				if (Object.keys(form.errors).some((key) => key !== "pdpa")) setStep("info");
				return;
			}
			// TODO: send form.data to the API once the backend exists.
			// Drop schoolName/major* when nonStudentStatuses.has(form.data.status).
		},
	});
	const { form: formData, enhance, validateForm } = form;

	const isStudent = $derived(!nonStudentStatuses.has($formData.status));

	// Form data lives in memory only, so landing on ?step=pdpa directly (reload, shared link)
	// has nothing to submit yet.
	onMount(async () => {
		if (step !== "pdpa") return;
		const { valid } = await validateForm({ schema: infoValidator });
		if (!valid) setStep("info");
	});

	async function next() {
		const { valid } = await validateForm({ update: true, schema: infoValidator, focusOnError: true });
		if (valid) setStep("pdpa");
	}

	// Each rank hides nothing but disables majors already picked in another rank.
	function majorChoices(field: MajorField) {
		const taken = majorFields.filter((other) => other !== field).map((other) => $formData[other]);
		return majorOptions.map((option) => ({ ...option, disabled: taken.includes(option.value) }));
	}
</script>

<svelte:head>
	<title>ลงทะเบียน | Science Chula Openhouse</title>
</svelte:head>

{#snippet textField(name: TextField, label: string, placeholder = "", type = "text")}
	<Form.Field {form} {name} class="space-y-1">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label class="text-base leading-normal font-normal text-brand-navy">{label}</Form.Label>
				<Input {...props} {type} {placeholder} bind:value={$formData[name]} />
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
{/snippet}

<form
	method="POST"
	use:enhance
	class="mx-auto flex w-full max-w-[402px] flex-1 flex-col gap-6 px-3 pt-6 pb-7"
>
	{#if step === "info"}
		<div class="flex justify-center">
			<SignBoard title="ลงทะเบียน" />
		</div>

		<section class="flex flex-col gap-2">
			<h2 class="text-xl font-medium text-brand-navy">ข้อมูลส่วนตัว</h2>
			<div class="flex flex-col gap-3">
				<div class="grid grid-cols-3 items-start gap-2">
					<Form.Field {form} name="prefix" class="space-y-1">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label class="text-base leading-normal font-normal text-brand-navy"
									>คำนำหน้า</Form.Label
								>
								<Picker
									id={props.id}
									name={props.name}
									options={prefixOptions}
									bind:value={$formData.prefix}
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
					{@render textField("firstName", "ชื่อ")}
					{@render textField("lastName", "นามสกุล")}
				</div>
				{#if $formData.prefix === "other"}
					{@render textField("prefixOther", "ระบุคำนำหน้า")}
				{/if}

				<Form.Field {form} name="age" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy"
								>อายุ (ปี)</Form.Label
							>
							<Input
								{...props}
								type="number"
								inputmode="numeric"
								min="1"
								max="120"
								bind:value={() => $formData.age || null, (age) => ($formData.age = age ?? 0)}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				{@render textField("province", "จังหวัดที่อยู่อาศัยในปัจจุบัน")}

				<div class="grid grid-cols-2 items-start gap-2">
					{@render textField("emergencyPhone", "หมายเลขติดต่อฉุกเฉิน", "0XXXXXXXXX", "tel")}
					{@render textField("emergencyName", "ชื่อผู้ติดต่อฉุกเฉิน", "ชื่อ นามสกุล")}
				</div>

				{@render textField(
					"specialNeeds",
					"ความต้องการพิเศษ (ถ้ามี)",
					"เช่น รถเข็นวีลแชร์ พิการทางการได้ยิน"
				)}
				{@render textField("reason", "เหตุผลในการเข้าร่วม")}
				{@render textField("expectation", "คาดหวังอะไรเกี่ยวกับงานนี้")}

				<Form.Field {form} name="newsSources" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy"
								>ช่องทางที่ได้ข่าวสารเกี่ยวกับงาน (เลือกได้มากกว่า 1 ข้อ)</Form.Label
							>
							<MultiPicker
								id={props.id}
								name={props.name}
								placeholder="ไม่มี"
								options={newsSourceOptions}
								bind:value={$formData.newsSources}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field {form} name="visitIntent" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy"
								>ตั้งใจมางานนี้หรือเดินผ่าน</Form.Label
							>
							<Picker
								id={props.id}
								name={props.name}
								placeholder="เลือกคำตอบ"
								options={visitIntentOptions}
								bind:value={$formData.visitIntent}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>
		</section>

		<Separator class="bg-[#3682b6]" />

		<section class="flex flex-col gap-2">
			<h2 class="text-xl font-medium text-brand-navy">สถานะผู้เข้าร่วมงาน</h2>
			<div class="flex flex-col gap-4">
				<Form.Field {form} name="status" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="sr-only">สถานะผู้เข้าร่วมงาน</Form.Label>
							<Picker
								id={props.id}
								name={props.name}
								placeholder="เลือกสถานะ"
								options={attendeeStatusOptions}
								bind:value={$formData.status}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				{#if $formData.status && isStudent}
					{@render textField("schoolName", "ชื่อสถานศึกษา")}

					{#each majorFields as field, rank (field)}
						<Form.Field {form} name={field} class="space-y-1">
							<Form.Control>
								{#snippet children({ props })}
									<Form.Label class="text-base leading-normal font-normal text-brand-navy"
										>สาขาวิชาที่สนใจ อันดับที่ {rank + 1}{rank > 0 ? " (ถ้ามี)" : ""}</Form.Label
									>
									<Picker
										id={props.id}
										name={props.name}
										placeholder="เลือกสาขาวิชา"
										options={majorChoices(field)}
										bind:value={$formData[field]}
									/>
								{/snippet}
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>
					{/each}
				{/if}
			</div>
		</section>

		<Button variant="cta" size="cta-lg" class="w-full" onclick={next}>ถัดไป</Button>
	{:else}
		<div class="flex justify-center">
			<SignBoard title="PDPA" />
		</div>

		<!-- TODO: replace with the real privacy policy text. -->
		<div class="flex-1 text-base text-brand-navy">
			Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam et ante vitae nibh luctus
			rhoncus. Sed luctus tristique varius. Duis lobortis tellus eu sapien facilisis, eget euismod
			quam elementum. Cras magna tortor, varius at massa non, egestas vehicula sem. Phasellus
			pellentesque magna eget rutrum facilisis. Mauris ultrices nibh at mi auctor feugiat congue in
			sapien. Aenean bibendum, nisl vel auctor congue, nibh metus commodo diam, id aliquam diam eros
			non leo
		</div>

		<div class="flex flex-col gap-2">
			<Form.Field {form} name="pdpa" class="space-y-1">
				<Form.Control>
					{#snippet children({ props })}
						<div class="flex items-center gap-2">
							<Checkbox
								{...props}
								bind:checked={$formData.pdpa}
								class="m-[3px] size-[18px] rounded-[3px] border-2 border-brand-brown bg-transparent text-brand-mist data-checked:border-brand-brown data-checked:bg-brand-brown dark:data-checked:bg-brand-brown"
							/>
							<Form.Label class="text-base leading-normal font-normal text-brand-brown"
								>ยอมรับนโยบายข้อมูลส่วนบุคคลและข้อกำหนดการใช้งานระบบ</Form.Label
							>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Button type="submit" variant="cta" size="cta-lg" class="w-full">ลงทะเบียน</Button>
		</div>
	{/if}
</form>
