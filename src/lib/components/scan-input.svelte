
<script lang="ts" module>
  const tabClass =
    "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 py-2 font-heading text-sm text-brand-brown sm:text-base";

  const activeTabClass =
    "border border-brand-brown bg-brand-yellow";

  type InputMode = "scan" | "code";
</script>

<script lang="ts">
  import keyboardIcon from "#lib/assets/icons/keyboard-onscreen.svg";
  import scannerIcon from "#lib/assets/icons/qr-code-scanner.svg";
  import QrScanner from "#lib/components/qr-scanner.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { errorDialog } from "#lib/error-dialog.svelte.js";

  type Props = {
    onScan: (code: string) => unknown;
    paused?: boolean;
    code?: string;
    codeLabel?: string;
  };

  let {
    onScan,
    paused = false,
    code = $bindable(""),
    codeLabel = "กรอกรหัสของผู้ร่วมงาน"
  }: Props = $props();

  let mode = $state<InputMode>("scan");
</script>

<div
  class="mx-auto flex w-full max-w-[300px] items-center rounded-full bg-brand-mist p-1"
  role="group"
  aria-label="วิธีสแกน"
>
  <button
    type="button"
    aria-pressed={mode === "scan"}
    class={[tabClass, mode === "scan" && activeTabClass]}
    onclick={() => (mode = "scan")}
  >
    <img
      src={scannerIcon}
      alt=""
      class="h-5 w-5 object-contain"
    />
    สแกน
  </button>

  <button
    type="button"
    aria-pressed={mode === "code"}
    class={[tabClass, mode === "code" && activeTabClass]}
    onclick={() => (mode = "code")}
  >
    <img
      src={keyboardIcon}
      alt=""
      class="h-5 w-5 object-contain"
    />
    กรอกรหัส
  </button>
</div>

{#if mode === "scan"}
  <div class="mx-auto mt-6 w-full max-w-[300px]">
    <QrScanner
      {onScan}
      paused={paused || errorDialog.current !== null}
    />
  </div>
{:else}
  <form
    class="mx-auto mt-6 flex w-full max-w-[340px] flex-col gap-3"
    onsubmit={(event) => {
      event.preventDefault();

      if (code.trim()) {
        void onScan(code.trim());
      }
    }}
  >
    <label
      for="scan-code"
      class="text-center text-sm text-brand-yellow"
    >
      {codeLabel}
    </label>

    <div class="flex gap-2">
      <Input
        id="scan-code"
        bind:value={code}
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        enterkeyhint="go"
        class="min-w-0 flex-1 focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60"
      />

      <Button
        type="submit"
        variant="cta"
        size="cta-sm"
        class="h-10 shrink-0 px-4 text-sm"
        disabled={!code.trim() || paused}
      >
        ตกลง
      </Button>
    </div>
  </form>
{/if}
