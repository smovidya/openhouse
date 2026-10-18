<script lang="ts">
 import { onMount } from "svelte";
 import { invalidateAll } from "$app/navigation";
 import { page } from "$app/state";
 import { createDevSession } from "#lib/features/auth/dev.remote.ts";
 import { logout } from "#lib/features/auth/auth.remote.ts";
 import { getTimeGates, setMockTime, clearMockTime } from "#lib/features/time/time.remote.ts";
 import { EVENT_SCHEDULE, type TimeGateSnapshot } from "#lib/constants/time.ts";
 import { toolbarPosition, toolbarPositions, fakeLoggedIn } from "#lib/dev-settings.svelte.js";
 import DevVisualSettings from "./dev-visual-settings.svelte";

 let busy = $state(false);
 let message = $state("");
 let failed = $state(false);
 let now = $state("");
 let gates = $state<TimeGateSnapshot>();
 const presets = [
  ["General registration opens", EVENT_SCHEDULE.generalRegistrationOpensAt],
  ["Workshops open", EVENT_SCHEDULE.workshopRegistrationOpensAt],
  ["Workshops close", EVENT_SCHEDULE.workshopRegistrationClosesAt],
  ["Event starts", EVENT_SCHEDULE.eventStartsAt],
  ["Event ends", EVENT_SCHEDULE.eventEndsAt],
 ];

 function showClock(snapshot: TimeGateSnapshot) {
  gates = snapshot;
  now = new Date(Date.parse(snapshot.now) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
 }

 async function run(action: () => Promise<unknown>, success: string) {
  if (busy) return;
  busy = true;
  message = "";
  failed = false;
  try {
   await action();
   await invalidateAll();
   message = success;
  } catch (cause) {
   failed = true;
   message = cause instanceof Error ? cause.message : "Request failed. Check the local database and retry.";
  } finally {
   busy = false;
  }
 }

 onMount(() => {
  void run(async () => showClock(await getTimeGates()), "Ready");
 });

 async function mockTime(value: string) {
  showClock(await setMockTime({ now: value }));
 }
</script>

<div class="controls" aria-busy={busy}>
 <p class="hint">Development only · this browser</p>
 <fieldset disabled={busy}>
  <legend>Session</legend>
  <p>{page.data.session?.user.name ?? "Signed out"}</p>
  <p class="hint">{page.data.session?.user.role ?? "Guest"} · server session</p>
  <div class="actions">
   {#each ["attendee", "newcomer", "staff"] as const as profile (profile)}
    <button type="button" onclick={() => run(async () => {
     await createDevSession({ profile });
     fakeLoggedIn.current = false;
    }, `Signed in as ${profile}`)}>Use {profile}</button>
   {/each}
   <button type="button" onclick={() => run(async () => {
    await logout();
    fakeLoggedIn.current = false;
   }, "Signed out")}>Sign out</button>
  </div>
  {#if gates && !gates.flags.signInOpen}
   <p class="hint">Sign-in gate is closed. Set the clock to registration opening before creating a session.</p>
  {/if}
 </fieldset>

 <fieldset disabled={busy}>
  <legend>Clock <span>{gates?.mocked ? "FROZEN" : "REAL"}</span></legend>
  <label>Bangkok time (UTC+07:00)
   <input type="datetime-local" bind:value={now} />
  </label>
  <div class="actions">
   <button type="button" disabled={!now} onclick={() => run(() => mockTime(now + ":00+07:00"), "Clock frozen")}>Freeze time</button>
   <button type="button" onclick={() => run(async () => showClock(await clearMockTime()), "Real clock restored")}>Use real time</button>
  </div>
  <div class="presets">
   {#each presets as [label, value] (label)}
    <button type="button" onclick={() => run(() => mockTime(value), label)}>{label} ↗</button>
   {/each}
  </div>
  {#if gates}
   <dl>
    {#each Object.entries(gates.flags) as [flag, enabled] (flag)}
     <div><dt>{flag}</dt><dd class={{ enabled }}>{enabled ? "ON" : "OFF"}</dd></div>
    {/each}
   </dl>
  {/if}
 </fieldset>

 <fieldset>
  <legend>Placement</legend>
  <label>Toolbar position
   <select bind:value={toolbarPosition.current}>
    {#each toolbarPositions as position (position)}
     <option value={position}>{position.replace("-", " ")}</option>
    {/each}
   </select>
  </label>
 </fieldset>

 <details>
  <summary>Visual settings & UI previews</summary>
  <div class="visual"><DevVisualSettings /></div>
 </details>
 <p class={{ error: failed }} role="status">{busy ? "Working…" : message}</p>
</div>

<style>
 .controls { color-scheme: dark; color: #e4e4e7; background: #18181b; padding: 18px; border-radius: 14px; font: 12px/1.6 ui-monospace, monospace; }
 .hint { color: #a1a1aa; font-size: 11px; }
 fieldset { margin: 16px 0; padding: 0; border: 0; min-width: 0; }
 legend { color: #fafafa; font-weight: 700; margin-bottom: 8px; }
 legend span { color: #a3e635; font-size: 10px; margin-left: 8px; }
 label { display: grid; gap: 6px; }
 input, select { width: 100%; min-width: 0; background: #27272a; border: 1px solid #52525b; border-radius: 6px; padding: 8px; color: #fafafa; }
 button { border: 1px solid #52525b; border-radius: 6px; padding: 7px 10px; background: #27272a; color: #fafafa; cursor: pointer; }
 button:hover { background: #3f3f46; }
 button:disabled { opacity: .5; cursor: wait; }
 button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid #a3e635; outline-offset: 3px; }
 .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
 .presets { display: grid; gap: 4px; margin-top: 10px; }
 .presets button { text-align: left; border: 0; background: transparent; color: #a1a1aa; }
 .presets button:hover { color: #fafafa; background: #27272a; }
 dl { margin-top: 12px; font-size: 10px; }
 dl div { display: flex; justify-content: space-between; gap: 8px; }
 dd { color: #71717a; }
 dd.enabled { color: #a3e635; }
 summary { cursor: pointer; }
 .visual { padding-top: 12px; }
 .error { color: #fda4af; }
</style>
