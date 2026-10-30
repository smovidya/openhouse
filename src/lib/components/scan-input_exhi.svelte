
<script lang="ts" module>
  const tabClass =
    "flex cursor-pointer items-center justify-center gap-1 rounded-full px-6 py-2 font-heading text-sm text-brand-brown";

  const activeTabClass =
    "border-2 border-brand-brown bg-brand-yellow";

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
  class="mx-auto flex w-fit max-w-full items-center overflow-hidden rounded-full bg-brand-mist"
  role="group"
  aria-label="วิธีสแกน"
>
  <button
    type="button"
    aria-pressed={mode === "scan"}
    class={[tabClass, "w-[132px]", mode === "scan" && activeTabClass]}
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
  <QrScanner
    {onScan}
    paused={paused || errorDialog.current !== null}
  />
{:else}
  <form
    class="mx-auto flex w-full max-w-[380px] flex-col items-center gap-4"
    onsubmit={(event) => {
      event.preventDefault();

      if (code.trim() && !paused && errorDialog.current === null) {
        void onScan(code.trim());
      }
    }}
  >
    <label
      for="exhibition-scan-code"
      class="text-center font-heading text-base text-brand-yellow"
    >
      {codeLabel}
    </label>

    <Input
      id="exhibition-scan-code"
      bind:value={code}
      autocomplete="off"
      autocapitalize="off"
      spellcheck={false}
      enterkeyhint="go"
      class="h-10 w-full min-w-0 rounded-md
             bg-white! text-gray-700!
             placeholder:text-gray-400!
             focus-visible:border-brand-yellow
             focus-visible:ring-brand-yellow/60"
    />

    <Button
      type="submit"
      variant="cta"
      size="cta-sm"
      class="mx-auto px-5 text-base"
      disabled={!code.trim() || paused || errorDialog.current !== null}
    >
      ลงทะเบียน
    </Button>
  </form>
{/if}
