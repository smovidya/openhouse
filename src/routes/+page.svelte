<script lang="ts">
	import logo from "#lib/assets/logo.png";
	import Countdown from "#lib/components/countdown.svelte";
	import Glass from "#lib/components/glass.svelte";
	import { Button } from "#lib/components/ui/button/index.js";

	const EVENT_START = "2026-10-31T13:00:00+07:00";
</script>

<svelte:head>
  <title>Components & Google sign-in demo</title>
</svelte:head>

<main
  class="flex flex-1 min-h-screen flex-col items-center justify-center gap-6 bg-brand-sky p-4"
>
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
  <section
    aria-labelledby="google-signin-heading"
    class="flex w-full max-w-[378px] flex-col gap-4 rounded-2xl border border-brand-navy/20 bg-white p-6 text-brand-navy"
  >
    <div>
      <p class="text-xs font-semibold uppercase tracking-widest">Frontend reference</p>
      <h2 id="google-signin-heading" class="mt-1 text-xl font-semibold">Google sign-in demo</h2>
      <p class="mt-2 text-sm">Uses the real authentication flow. Signing in creates a user session.</p>
    </div>

    {#if session}
      <div class="flex flex-col gap-1 text-sm">
        <p class="font-semibold">Signed in as {session.user.name}</p>
        <p class="break-all">{session.user.email}</p>
        <p>Role: {session.user.role}</p>
        <p class="break-all">User ID: {session.user.id}</p>
      </div>
      <Button type="button" variant="outline" onclick={handleLogout} disabled={authBusy}>
        {authStatus === "signing-out" ? "Signing out…" : "Sign out"}
      </Button>
    {/if}

    <!-- Keep the container mounted so Google's iframe survives status updates. -->
    <div hidden={!!session || authStatus !== "ready" || pendingDevProfile !== null}>
      {#key googleButtonVersion}
        <div {@attach renderGoogleButton}></div>
      {/key}
    </div>

    <p role="status" class="text-sm">
      {#if !session && authStatus === "loading"}
        Loading Google sign-in…
      {:else if !session && authStatus === "signing-in"}
        Signing in…
      {:else if session && authStatus !== "signing-out"}
        Your session is active.
      {/if}
    </p>
    {#if authError}
      <p role="alert" class="text-sm text-red-700">{authError}</p>
    {/if}
    {#if !session && (authStatus === "error" || authStatus === "ready")}
      <Button type="button" variant="outline" onclick={prepareGoogleSignIn} disabled={authBusy}>
        {authStatus === "error" ? "Try again" : "Restart sign-in"}
      </Button>
    {/if}
  </section>

  {#if dev}
    <section
      aria-labelledby="dev-session-heading"
      class="flex w-full max-w-[378px] flex-col gap-4 rounded-2xl border border-brand-navy/20 bg-white p-6 text-brand-navy"
    >
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest">Development only</p>
        <h2 id="dev-session-heading" class="mt-1 text-xl font-semibold">Dev session demo</h2>
        <p class="mt-2 text-sm">
          Set the current session to a demo attendee or staff user without Google sign-in.
          Choosing a profile replaces the current session.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={authBusy}
          onclick={() => handleDevSession("attendee")}
        >
          {pendingDevProfile === "attendee" ? "Setting attendee session…" : "Use demo attendee"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={authBusy}
          onclick={() => handleDevSession("staff")}
        >
          {pendingDevProfile === "staff" ? "Setting staff session…" : "Use demo staff"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!session || authBusy}
          onclick={handleLogout}
        >
          {authStatus === "signing-out" ? "Signing out…" : "Clear current session"}
        </Button>
      </div>

      <p role="status" class="text-sm">
        {#if pendingDevProfile}
          Setting the current session to the demo {pendingDevProfile}…
        {:else if session}
          Current user: {session.user.name} ({session.user.role})
        {:else}
          No active session.
        {/if}
      </p>
      {#if devSessionError}
        <p role="alert" class="text-sm text-red-700">{devSessionError}</p>
      {/if}

      <div class="min-w-0">
        <h3 class="mb-2 text-sm font-semibold">Current session (page.data.session)</h3>
        <pre class="max-h-80 overflow-auto rounded-lg bg-brand-sky p-3 text-xs"><code>{JSON.stringify(session, null, 2)}</code></pre>
      </div>
    </section>
  {/if}
</main>
