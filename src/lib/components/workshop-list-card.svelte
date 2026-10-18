<script lang="ts" module>
	const dateFormat = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "long",
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
	import Glass from "#lib/render/glass.svelte";

	let { workshop }: { workshop: Workshop } = $props();

	let expanded = $state(false);

	const days = $derived(sessionsByDay(workshop.sessions));

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
		<div class="flex min-w-0 flex-1 flex-col">
			<h3 class="text-base font-medium text-brand-yellow">{workshop.title}</h3>
			<p class="text-[10px] text-brand-mist">{workshop.hostDepartmentAbbr}</p>
		</div>
		<Button variant="cta" size="cta-sm" href="/workshop/{workshop.id}">ลงทะเบียน</Button>
	</div>

	<!-- One row per day: the date, then that day's sessions in two columns (filled top to bottom).
	     From 400px the dates and times share one grid, which keeps the times aligned when the
	     dates differ in width; narrower, each date sits above its times. -->
	<div
		class="flex flex-col gap-3 text-xs text-brand-yellow min-[400px]:grid min-[400px]:grid-cols-[auto_minmax(0,1fr)] min-[400px]:items-start min-[400px]:gap-x-4"
	>
		{#each days as { day, sessions } (day)}
			<div class="flex flex-col gap-1 min-[400px]:contents">
				<p class="flex items-center gap-1">
					<img src={calendarIcon} alt="" />
					<time datetime={day}>{dateFormat.format(new Date(sessions[0].start))}</time>
				</p>
				<div class="flex min-w-0 items-start gap-1">
					<img src={clockIcon} alt="" class="shrink-0" />
					<ul
						class="grid min-w-0 flex-1 grid-flow-col grid-cols-2 gap-x-2"
						style:grid-template-rows="repeat({Math.ceil(sessions.length / 2)}, auto)"
					>
						{#each sessions as session (session.id)}
							<li>
								<time datetime={session.start}>{formatTime(session.start)}</time> -
								<time datetime={session.end}>{formatTime(session.end)}</time>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/each}
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
