<script lang="ts">
	import { onMount } from "svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { beginGoogleSignIn, signInWithGoogle } from "#lib/features/auth/auth.client.js";
	import { loadGoogleIdentity, type GoogleIdentity } from "#lib/features/auth/google.client.js";

	type Props = {
		/** Runs once the session cookie is set and layout data is refreshed. */
		onSignedIn?: () => void | Promise<void>;
	};

	let { onSignedIn }: Props = $props();

	let status = $state<"loading" | "ready" | "signing-in" | "error">("loading");
	let errorDetail = $state("");
	let container = $state<HTMLDivElement>();
	let width = $state(0);
	let google: GoogleIdentity | undefined;
	let disposed = false;

	function fail(error: unknown) {
		if (disposed) return;
		errorDetail = error instanceof Error ? error.message : "";
		status = "error";
	}

	/** Every attempt needs a fresh login challenge: the server's nonce is single use. */
	async function prepare() {
		status = "loading";
		errorDetail = "";
		try {
			google = await loadGoogleIdentity();
			const { clientId, nonce } = await beginGoogleSignIn();
			if (disposed) return;
			google.initialize({
				client_id: clientId,
				nonce,
				auto_select: false,
				callback: (response) => void handleCredential(response.credential),
			});
			status = "ready";
		} catch (error) {
			fail(error);
		}
	}

	async function handleCredential(googleIdToken: string) {
		if (disposed || status !== "ready") return;
		status = "signing-in";
		try {
			// Sets the session cookie, then refreshes page.data.session.
			await signInWithGoogle({ googleIdToken });
			await onSignedIn?.();
		} catch (error) {
			fail(error);
		}
	}

	// Google draws its own button (its sign-in can't be started from ours). Redraw when the
	// challenge is renewed or the available width changes.
	$effect(() => {
		if (status !== "ready" || !container || !google) return;
		container.replaceChildren();
		google.renderButton(container, {
			type: "standard",
			theme: "outline",
			size: "large",
			text: "continue_with",
			shape: "pill",
			width: Math.round(Math.min(400, Math.max(200, width))),
			locale: "th",
		});
	});

	onMount(() => {
		void prepare();
		return () => {
			disposed = true;
		};
	});
</script>

<div bind:clientWidth={width} class="flex w-full flex-col items-center gap-3">
	<!-- Kept mounted (and its height reserved) so Google's iframe survives status changes. -->
	<div
		bind:this={container}
		class={["flex min-h-11 w-full justify-center", status !== "ready" && "hidden"]}
	></div>

	<p role="status" class="text-sm text-brand-mist">
		{#if status === "loading"}
			กำลังโหลด Google…
		{:else if status === "signing-in"}
			กำลังเข้าสู่ระบบ…
		{/if}
	</p>

	{#if status === "error"}
		<div role="alert" class="flex flex-col items-center gap-2 text-center">
			<p class="text-sm text-brand-yellow">เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง</p>
			{#if errorDetail}
				<p class="text-xs text-brand-mist">{errorDetail}</p>
			{/if}
			<Button variant="cta" size="cta-sm" onclick={prepare}>ลองอีกครั้ง</Button>
		</div>
	{/if}
</div>
