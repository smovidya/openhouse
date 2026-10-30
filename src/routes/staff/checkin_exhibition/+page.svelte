
<script lang="ts">
  import { onMount } from "svelte";
  import ScanInput from "#lib/components/scan-input_exhi.svelte";
  import ScanSheet from "#lib/components/scan-sheet.svelte";
  import AttendeeDetails from "#lib/components/attendee-details.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import * as Drawer from "#lib/components/ui/drawer/index.js";
  import * as RadioGroup from "#lib/components/ui/radio-group/index.js";
  import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
  import {
    checkInAttendee,
    listScannableCheckpoints
  } from "#lib/features/checkpoints/checkpoints.remote.ts";
  import { showError } from "#lib/error-dialog.svelte.js";
  import { httpStatus } from "#lib/utils.js";

  type Booth = {
    id: string;
    name: string;
  };

  type Attendee = Awaited<
    ReturnType<typeof getAttendeeProfileByQrCodeId>
  >;

  type Sheet = {
    attendee: Attendee;
    boothId: string;
    boothName: string;
    state: "confirming" | "checkingIn" | "closed";
  };

  let boothOpen = $state(true);
  let selectedBooth = $state("");
  let scanCode = $state("");
  let sheet = $state<Sheet | null>(null);
  let lookingUp = $state(false);
  let savedNotice = $state("");

  let booths = $state<Booth[]>([]);
  let loadingBooths = $state(true);

  let selectedBoothItem = $derived(
    booths.find((booth) => booth.id === selectedBooth)
  );

  let selectedBoothName = $derived(
    selectedBoothItem?.name ?? "กรุณาเลือกบูธ"
  );

  let sheetOpen = $derived(
    sheet !== null && sheet.state !== "closed"
  );

  onMount(() => {
    void loadBooths();
  });

  async function loadBooths() {
    loadingBooths = true;

    try {
      booths = await listScannableCheckpoints();
    } catch (caught) {
      await showError({
        title: "โหลดข้อมูลบูธไม่สำเร็จ",
        description:
          "ไม่สามารถโหลดบูธที่สามารถเช็คอินได้ กรุณาลองอีกครั้ง"
      });
    } finally {
      loadingBooths = false;
    }
  }

  async function lookUp(qrCodeId: string) {
    if (lookingUp || sheetOpen) return;

    savedNotice = "";
    const cleaned = qrCodeId.trim();

    if (!selectedBoothItem) {
      await showError({
        title: "กรุณาเลือกบูธ",
        description:
          "กรุณาเลือกบูธนิทรรศการก่อนสแกนหรือกรอกรหัส"
      });
      return;
    }

    if (!cleaned) {
      await showError({
        title: "กรุณากรอกรหัส",
        description:
          "กรุณาสแกน QR หรือกรอกรหัสของผู้เข้าร่วมงาน"
      });
      return;
    }

    lookingUp = true;

    try {
      const attendee =
        await getAttendeeProfileByQrCodeId(cleaned);

      sheet = {
        attendee,
        boothId: selectedBoothItem.id,
        boothName: selectedBoothItem.name,
        state: "confirming"
      };
    } catch (caught) {
      const status = httpStatus(caught);

      await showError(
        status === 404
          ? {
              title: "ไม่พบผู้เข้าร่วมงาน",
              description:
                "ไม่พบผู้เข้าร่วมงานจากรหัสนี้ กรุณาตรวจสอบแล้วลองอีกครั้ง"
            }
          : status === 403
            ? {
                title: "ไม่มีสิทธิ์",
                description:
                  "บัญชีนี้ไม่มีสิทธิ์ค้นหาข้อมูลผู้เข้าร่วมงาน"
              }
            : {
                title: "ค้นหาไม่สำเร็จ",
                description:
                  "ระบบไม่สามารถค้นหาผู้เข้าร่วมงานได้ กรุณาลองอีกครั้ง"
              }
      );
    } finally {
      lookingUp = false;
    }
  }

  function closeSheet() {
    if (sheet?.state === "confirming") {
      sheet.state = "closed";
    }
  }

  async function confirmCheckin() {
    const current = sheet;

    if (current?.state !== "confirming") return;

    current.state = "checkingIn";

    const attendee = current.attendee;
    const name =
      `${attendee.firstname} ${attendee.lastname}`;

    try {
      const result = await checkInAttendee({
        qrCodeId: attendee.qrCodeId,
        checkpointId: current.boothId
      });

      if (result.alreadyCheckedIn) {
        current.state = "closed";

        await showError({
          title: "เช็คอินซ้ำ",
          description:
            `${name} เช็คอิน ${current.boothName} ไปแล้วก่อนหน้านี้`
        });
      } else {
        savedNotice =
          `เช็คอิน ${name} ที่ ${current.boothName} สำเร็จ`;

        scanCode = "";
      }
    } catch (caught) {
      const status = httpStatus(caught);

      current.state = "closed";

      await showError(
        status === 403
          ? {
              title: "ไม่มีสิทธิ์",
              description:
                "บัญชีนี้ไม่มีสิทธิ์เช็คอินบูธนิทรรศการนี้"
            }
          : status === 404
            ? {
                title: "ไม่พบข้อมูล",
                description:
                  "ไม่พบผู้เข้าร่วมงานหรือจุดเช็คอินนี้"
              }
            : {
                title: "เช็คอินไม่สำเร็จ",
                description:
                  "ไม่สามารถบันทึกเช็คอินได้ กรุณาลองอีกครั้ง"
              }
      );
    } finally {
      current.state = "closed";
    }
  }
</script>

<svelte:head>
  <title>เช็คอินบูธนิทรรศการ | Open House</title>
  <meta
    name="description"
    content="เช็คอินบูธนิทรรศการ Open House"
  />
</svelte:head>

<div class="min-h-screen bg-brand-navy text-white">
  <main
    class="mx-auto flex min-h-screen w-full
           max-w-[450px] flex-col
           px-4 pt-8 pb-12 sm:px-6"
  >
    <h1
      class="mb-7 text-center text-[27px]
             font-medium text-brand-yellow"
    >
      เช็คอินบูธนิทรรศการ
    </h1>

    <section
      class="mb-8 flex w-full flex-col items-center gap-8"
      aria-label="สแกนหรือกรอกรหัสเพื่อเช็คอิน"
    >
      <ScanInput
        onScan={lookUp}
        paused={lookingUp || sheetOpen || loadingBooths}
        bind:code={scanCode}
      />
      
    </section>
    

    <section class="mt-1">
      <h2
        class="mb-3 text-lg font-medium text-brand-mist"
      >
        เลือกบูธนิทรรศการ
      </h2>

      <div
        class="overflow-hidden rounded-lg border
               border-brand-mist bg-brand-mist
               text-brand-brown"
      >
        <button
          type="button"
          aria-expanded={boothOpen}
          onclick={() => (boothOpen = !boothOpen)}
          class="flex min-h-11 w-full items-center
                 justify-between gap-2 px-3
                 text-left text-sm"
        >
          <span class="truncate">
            {selectedBoothName}
          </span>

          <svg
            class:rotate-180={boothOpen}
            class="shrink-0 transition-transform"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {#if boothOpen}
          <div class="px-3 pb-2">
            {#if loadingBooths}
              <p class="py-3 text-sm">
                กำลังโหลดข้อมูลบูธ…
              </p>
            {:else if booths.length === 0}
              <p class="py-3 text-sm">
                ไม่พบบูธที่สามารถเช็คอินได้
              </p>
            {:else}
              <RadioGroup.Root
                bind:value={selectedBooth}
                class="grid gap-0"
              >
                {#each booths as booth (booth.id)}
                  <label
                    class="flex cursor-pointer items-center
                           justify-between gap-2
                           border-t border-brand-brown/20
                           py-2 text-sm"
                  >
                    <span>{booth.name}</span>

                    <RadioGroup.Item
                      value={booth.id}
                    />
                  </label>
                {/each}
              </RadioGroup.Root>
            {/if}
          </div>
        {/if}
      </div>
    </section>

    {#if lookingUp}
      <p
        role="status"
        class="mt-4 text-center text-sm text-brand-mist"
      >
        กำลังค้นหาผู้เข้าร่วมงาน…
      </p>
    {/if}

    {#if savedNotice}
      <p
        role="status"
        class="mt-5 rounded-lg border border-brand-yellow
               p-3 text-center text-sm text-brand-mist"
      >
        {savedNotice}
      </p>
    {/if}

    <Button
      variant="cta-light"
      size="cta-lg"
      href="/checkin_exhibition/history"
      class="mx-auto mt-9"
    >
      ดูประวัติการเช็คอิน →
    </Button>
  </main>
</div>

<ScanSheet open={sheetOpen} onclose={closeSheet}>
  {#if sheet}
    <div
      class="flex flex-1 flex-col
             items-center justify-between"
    >
      <div class="flex w-full flex-col gap-6 px-4">
        <Drawer.Title
          class="text-center font-heading
                 text-[28px] font-medium text-black"
        >
          เช็คอินผู้เข้าร่วมงาน
        </Drawer.Title>

        <AttendeeDetails attendee={sheet.attendee} />

        <dl
          class="grid grid-cols-[110px_1fr] gap-3
                 border-t border-brand-brown/20
                 pt-5 text-base
                 sm:grid-cols-[130px_1fr]"
        >
          <dt class="text-brand-brown">
            บูธนิทรรศการ
          </dt>

          <dd class="leading-relaxed text-black">
            {sheet.boothName}
          </dd>
        </dl>
      </div>

      <div class="flex w-full flex-col gap-2">
        <Button
          variant="cta-light"
          size="cta-lg"
          class="w-full"
          disabled={sheet.state !== "confirming"}
          onclick={closeSheet}
        >
          ยกเลิก
        </Button>

        <Button
          variant="cta"
          size="cta-lg"
          class="w-full"
          disabled={sheet.state !== "confirming"}
          onclick={confirmCheckin}
        >
          {sheet.state === "checkingIn"
            ? "กำลังเช็คอิน…"
            : "ตกลง"}
        </Button>
      </div>
    </div>
  {/if}
</ScanSheet>
