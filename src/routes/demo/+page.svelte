<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import {
    Picker,
    type PickerOption,
  } from "#lib/components/ui/picker/index.js";
  import MoveRight from "@lucide/svelte/icons/move-right";
  import {
    beginGoogleSignIn,
    logout,
    signInWithGoogle,
  } from "#lib/features/auth/auth.client.js";

  // Kept inline as a reference for the frontend team, before extracting a component.
  // API reference: https://developers.google.com/identity/gsi/web/reference/js-reference
  type GoogleIdentityServices = {
    initialize: (options: {
      client_id: string;
      nonce: string;
      callback: (response: { credential: string }) => void;
      auto_select: boolean;
    }) => void;
    renderButton: (
      container: HTMLElement,
      options: {
        type: "standard";
        theme: "outline";
        size: "large";
        text: "signin_with";
        width: number;
      },
    ) => void;
    disableAutoSelect: () => void;
  };

  let google: GoogleIdentityServices | undefined;
  let googleButtonVersion = $state(0);
  let disposed = false;
  let authStatus = $state<
    "loading" | "ready" | "signing-in" | "signing-out" | "error"
  >("loading");
  let authError = $state("");
  const session = $derived(page.data.session);
  const authBusy = $derived(
    authStatus === "signing-in" || authStatus === "signing-out",
  );


  function showAuthError(error: unknown) {
    if (disposed) return;
    authError = error instanceof Error ? error.message : "Sign-in failed. Please try again.";
    authStatus = "error";
  }

  async function prepareGoogleSignIn() {
    if (disposed || session) return;
    if (!google) {
      // A reload also retries a blocked or failed SDK download.
      window.location.reload();
      return;
    }
    authError = "";
    authStatus = "loading";
    try {
      // 1. Browser-only command: the server sets the login challenge cookie.
      const { clientId, nonce } = await beginGoogleSignIn();
      if (disposed || session) return;

      // 2. Use the JavaScript API so the callback stays in this Svelte scope.
      google.initialize({
        client_id: clientId,
        nonce,
        auto_select: false,
        callback: (response) => { void handleSignIn(response); },
      });
      googleButtonVersion += 1;
      authStatus = "ready";
    } catch (error) {
      showAuthError(error);
    }
  }

  function renderGoogleButton(container: HTMLDivElement) {
    try {
      google?.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 280,
      });
    } catch (error) {
      showAuthError(error);
    }
  }

  async function handleSignIn(response: { credential: string }) {
    if (disposed || session || authStatus !== "ready" || authBusy) return;
    authStatus = "signing-in";
    authError = "";
    try {
      // 3. Google sends an object, not a token string. The helper refreshes
      // layout data after setting the session cookie; session updates below.
      await signInWithGoogle({ googleIdToken: response.credential });
    } catch (error) {
      showAuthError(error);
    }
  }

  async function handleLogout() {
    if (authBusy) return;
    authStatus = "signing-out";
    authError = "";
    try {
      await logout();
      google?.disableAutoSelect();
      if (!disposed) await prepareGoogleSignIn();
    } catch (error) {
      showAuthError(error);
    }
  }

  onMount(() => {
    // Load after hydration, and initialize only after the SDK is ready.
    const sdkWindow = window as Window & {
      google?: { accounts: { id: GoogleIdentityServices } };
    };
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      showAuthError(new Error("Google sign-in took too long to load. Please try again."));
    }, 15000);
    function handleLoad() {
      window.clearTimeout(timeout);
      if (disposed) return;
      google = sdkWindow.google?.accounts.id;
      if (!google) {
        showAuthError(new Error("Google sign-in is unavailable. Please try again."));
        return;
      }
      if (!session) void prepareGoogleSignIn();
    }
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = handleLoad;
    script.onerror = () => {
      window.clearTimeout(timeout);
      showAuthError(new Error("Could not load Google sign-in. Check your connection and try again."));
    };
    if (sdkWindow.google?.accounts.id) handleLoad();
    else document.head.appendChild(script);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      script.remove();
    };
  });

  const attendeeStatuses: PickerOption[] = [
    { value: "upper-secondary", label: "มัธยมศึกษาตอนปลาย" },
    { value: "lower-secondary", label: "มัธยมศึกษาตอนต้น" },
    { value: "parent", label: "ผู้ปกครอง" },
  ];

  let attendeeStatus = $state("");
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
    <div hidden={!!session || authStatus !== "ready"}>
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

</main>
