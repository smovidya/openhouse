<script lang="ts" module>
	const dateFormat = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "long",
		timeZone: "Asia/Bangkok",
	});
	const dayFormat = new Intl.DateTimeFormat("th-TH", {
		day: "numeric",
		month: "short",
		timeZone: "Asia/Bangkok",
	});
	const timeFormat = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Bangkok",
	});
	const formatTime = (iso: string) => `${timeFormat.format(new Date(iso))} น.`;
</script>

<script lang="ts">
	import calendarIcon from "#lib/assets/icons/calendar.svg";
	import clockIcon from "#lib/assets/icons/clock.svg";
	import { Button } from "#lib/components/ui/button/index.js";
	import { sessionsByDay, type Workshop } from "#lib/workshops.js";
	import Glass from "./glass.svelte";

	let { workshop }: { workshop: Workshop } = $props();

	let expanded = $state(false);

	const days = $derived(sessionsByDay(workshop.sessions));
	const firstStart = $derived(workshop.sessions.at(0)?.start);
	const lastStart = $derived(workshop.sessions.at(-1)?.start);

	// Pressing anywhere on the card expands the description; its own controls keep their action.
	function toggle(event: MouseEvent) {
		if ((event.target as Element).closest("a, button")) return;
		expanded = !expanded;
	}
</script>

<Glass
	as="article"
	class={["flex flex-col gap-3 rounded-lg p-3", workshop.description && "cursor-pointer"]}
	onclick={workshop.description ? toggle : undefined}
>
	<div class="flex items-start gap-3">
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex flex-col">
				<h3 class="text-base font-medium text-brand-yellow">{workshop.title}</h3>
				<p class="text-[10px] text-brand-mist">{workshop.hostDepartmentAbbr}</p>
			</div>
			{#if firstStart && lastStart}
				<p class="flex items-center gap-1 text-xs text-brand-yellow">
					<img src={calendarIcon} alt="" />
					{dateFormat.formatRange(new Date(firstStart), new Date(lastStart))}
				</p>
			{/if}
		</div>
		<Button variant="cta" size="cta-sm" href="/workshop/{workshop.id}">ลงทะเบียน</Button>
	</div>

	<div class="flex items-center gap-6 text-xs">
		<p class="flex shrink-0 items-center gap-1 text-brand-yellow">
			<img src={clockIcon} alt="" />
			รอบเวลาทั้งหมด
		</p>
		<ul class="flex min-w-0 flex-1 flex-col gap-1 text-brand-mist">
			{#each days as { day, sessions } (day)}
				<li>
					<time datetime={day} class="text-brand-yellow">
						{dayFormat.format(new Date(sessions[0].start))}
					</time>
					<ul>
						{#each sessions as session (session.id)}
							<li>
								<time datetime={session.start}>{formatTime(session.start)}</time> -
								<time datetime={session.end}>{formatTime(session.end)}</time>
								<span
									class={session.registered >= session.capacity
										? "text-status-red"
										: "text-status-green"}
								>
									({session.registered}/{session.capacity})
								</span>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	</div>

	{#if workshop.description}
		<button
			type="button"
			aria-expanded={expanded}
			class="block w-full cursor-pointer rounded-sm text-left text-xs text-brand-mist outline-none focus-visible:ring-3 focus-visible:ring-brand-mist/50"
			onclick={() => (expanded = !expanded)}
		>
			<span class={[!expanded && "line-clamp-2"]}>{workshop.description}</span>
		</button>
	{/if}
</Glass>
