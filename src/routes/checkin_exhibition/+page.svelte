<script lang="ts">
  import { goto } from '$app/navigation';
  import ScanInput from '#lib/components/scan-input.svelte';
  import AttendeeDetails from '#lib/components/attendee-details.svelte';
  import { getAttendeeProfileByQrCodeId } from '#lib/features/attendees/attendees.remote.ts';
  import { checkInAttendee } from '#lib/features/checkpoints/checkpoints.remote.ts';
  import { httpStatus } from '#lib/utils.js';

  type Booth = { id: string; name: string };
  type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
  type Sheet = { attendee: Attendee; state: 'confirming' | 'checkingIn' | 'closed' };

  // Optional route data. Supply real exhibition checkpoint IDs from your team's loader.
  // Expected: { booths: [{ id: '<real checkpoint id>', name: 'Booth name' }] }
  let { data }: { data?: { booths?: Booth[] } } = $props();

  let boothOpen = $state(true);
  let selectedBooth = $state('');
  let scanCode = $state('');
  let sheet = $state<Sheet | null>(null);
  let lookingUp = $state(false);
  let showError = $state(false);
  let errorTitle = $state('ไม่สามารถเช็คอินได้');
  let errorMessage = $state('');
  let savedNotice = $state('');

  const sampleBooths: Booth[] = [
    { id: '', name: 'Mathematics and computer science 1' },
    { id: '', name: 'Mathematics and computer science 2' },
    { id: '', name: 'Mathematics and computer science 3' }
  ];

  // Sample names preserve the original screenshot. Empty IDs cannot be used for real check-in.
  let booths = $derived(data?.booths?.length ? data.booths : sampleBooths);
  let selectedBoothItem = $derived(booths.find((booth, index) => String(index) === selectedBooth));
  let selectedBoothName = $derived(selectedBoothItem?.name ?? 'กรุณาเลือกบูธ');
  let selectedCheckpointId = $derived(selectedBoothItem?.id ?? '');
  let sheetOpen = $derived(sheet !== null && sheet.state !== 'closed');

  function showCheckinError(title: string, detail: string) {
    errorTitle = title;
    errorMessage = detail;
    showError = true;
    savedNotice = '';
  }

  async function lookUp(qrCodeId: string) {
    if (lookingUp || sheetOpen || showError) return;
    const cleaned = qrCodeId.trim();
    savedNotice = '';

    if (!selectedBoothItem) {
      showCheckinError('กรุณาเลือกบูธ', 'กรุณาเลือกบูธนิทรรศการก่อนสแกนหรือกรอกรหัส');
      return;
    }
    if (!selectedCheckpointId) {
      showCheckinError('ยังไม่ได้ตั้งค่าบูธ', 'ยังไม่มี checkpoint ID จริงสำหรับบูธนี้ กรุณาเชื่อมข้อมูลบูธจากระบบก่อนเช็คอิน');
      return;
    }
    if (!cleaned) {
      showCheckinError('กรุณากรอกรหัส', 'กรุณาสแกน QR หรือกรอกรหัสของผู้เข้าร่วมงาน');
      return;
    }

    lookingUp = true;
    try {
      const attendee = await getAttendeeProfileByQrCodeId(cleaned);
      sheet = { attendee, state: 'confirming' };
    } catch (caught) {
      showCheckinError(
        httpStatus(caught) === 404 ? 'ไม่พบผู้เข้าร่วมงาน' : httpStatus(caught) === 403 ? 'ไม่มีสิทธิ์' : 'ค้นหาไม่สำเร็จ',
        httpStatus(caught) === 404
          ? 'ไม่พบผู้เข้าร่วมงานจากรหัสนี้ กรุณาตรวจสอบแล้วลองอีกครั้ง'
          : httpStatus(caught) === 403
            ? 'บัญชีนี้ไม่มีสิทธิ์ค้นหาข้อมูลผู้เข้าร่วมงาน'
            : 'ระบบไม่สามารถค้นหาผู้เข้าร่วมงานได้ กรุณาลองอีกครั้ง'
      );
    } finally {
      lookingUp = false;
    }
  }

  function closeSheet() {
    if (sheet?.state === 'confirming') sheet.state = 'closed';
  }

  async function confirmCheckin() {
    const current = sheet;
    if (!current || current.state !== 'confirming') return;
    if (!selectedCheckpointId) {
      current.state = 'closed';
      showCheckinError('ยังไม่ได้ตั้งค่าบูธ', 'ไม่พบ checkpoint ID สำหรับบูธที่เลือก');
      return;
    }

    current.state = 'checkingIn';
    const attendee = current.attendee;
    const name = `${attendee.firstname} ${attendee.lastname}`;
    try {
      const result = await checkInAttendee({ qrCodeId: attendee.qrCodeId, checkpointId: selectedCheckpointId });
      if (result.alreadyCheckedIn) {
        showCheckinError('เช็คอินซ้ำ', `${name} เช็คอิน ${selectedBoothName} ไปแล้วก่อนหน้านี้`);
      } else {
        savedNotice = `เช็คอิน ${name} ที่ ${selectedBoothName} สำเร็จ`;
        scanCode = '';
      }
    } catch (caught) {
      const status = httpStatus(caught);
      showCheckinError(
        status === 403 ? 'ไม่มีสิทธิ์' : status === 404 ? 'ไม่พบข้อมูล' : 'เช็คอินไม่สำเร็จ',
        status === 403
          ? 'บัญชีนี้ไม่มีสิทธิ์เช็คอินบูธนิทรรศการนี้'
          : status === 404
            ? 'ไม่พบผู้เข้าร่วมงานหรือจุดเช็คอินนี้'
            : 'ไม่สามารถบันทึกเช็คอินได้ กรุณาลองอีกครั้ง'
      );
    } finally {
      current.state = 'closed';
    }
  }
</script>

<svelte:head>
  <title>เช็คอินบูธนิทรรศการ | Open House</title>
  <meta name="description" content="เช็คอินบูธนิทรรศการ Open House" />
</svelte:head>

<div class="min-h-screen bg-[#243e65] text-white">
  <main class="mx-auto flex min-h-screen w-full max-w-[450px] flex-col px-4 pb-12 pt-8 sm:px-6">
    <h1 class="mb-7 text-center text-[27px] font-medium text-[#ffd65e]">เช็คอินบูธนิทรรศการ</h1>

    <section class="mb-8 w-full justify-center" aria-label="สแกนหรือกรอกรหัสเพื่อเช็คอิน">
      <ScanInput
        onScan={lookUp}
        paused={lookingUp || sheetOpen || showError}
        bind:code={scanCode}
      />
    </section>

    <section class="mt-1">
      <h2 class="mb-3 text-lg font-medium text-[#a8c2da]">เลือกบูธนิทรรศการ</h2>
      <div class="overflow-hidden rounded-lg border border-[#a9c5e2] bg-[#f2f7fa] text-[#596b86]">
        <button type="button" aria-expanded={boothOpen} onclick={() => (boothOpen = !boothOpen)} class="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm">
          <span class="truncate">{selectedBoothName}</span>
          <svg class:rotate-180={boothOpen} class="shrink-0 transition-transform" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#243e65" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {#if boothOpen}
          <div class="px-3 pb-2">
            {#each booths as booth, index}
              <label class="flex cursor-pointer items-center justify-between gap-2 border-t border-[#a9c5e2] py-2 text-sm">
                <span>{booth.name}</span>
                <input type="radio" name="booth" value={String(index)} bind:group={selectedBooth} class="h-4 w-4 shrink-0 accent-[#243e65]" />
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    {#if lookingUp}
      <p role="status" class="mt-4 text-center text-sm text-[#c6d9ed]">กำลังค้นหาผู้เข้าร่วมงาน…</p>
    {/if}

    {#if savedNotice}
      <p role="status" class="mt-5 rounded-lg bg-green-900/30 p-3 text-center text-sm text-green-100">{savedNotice}</p>
    {/if}

    <button type="button" onclick={() => goto('/checkin_exhibition/history')} class="mx-auto mt-9 rounded-full bg-[#f9fafb] px-6 py-2 text-sm font-medium text-[#84553c] hover:bg-white">
      ดูประวัติการเช็คอิน →
    </button>
  </main>
</div>

{#if sheetOpen && sheet}
  <div class="fixed inset-0 z-40 bg-black/55" role="presentation"></div>
  <div class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[26px] bg-[#edf3f8] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-10 text-[#1a1a1a] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <button type="button" aria-label="ปิด" onclick={closeSheet} class="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe5ea] text-2xl text-[#4b5563]">×</button>
    <h2 id="confirm-title" class="mb-7 text-center text-[26px] font-semibold">เช็คอินผู้เข้าร่วมงาน</h2>
    <AttendeeDetails attendee={sheet.attendee} />
    <div class="my-6 h-px bg-[#96bbda]"></div>
    <dl class="grid grid-cols-[110px_1fr] gap-3 text-[16px] sm:grid-cols-[130px_1fr]">
      <dt class="text-[#45658d]">บูธนิทรรศการ</dt><dd class="leading-relaxed">{selectedBoothName}</dd>
    </dl>
    <div class="mt-12 flex flex-col gap-3">
      <button type="button" onclick={closeSheet} class="h-14 rounded-full border border-[#81513b] font-medium text-[#81513b]">ยกเลิก</button>
      <button type="button" onclick={confirmCheckin} disabled={sheet?.state === "checkingIn"} class="h-14 rounded-full bg-[#ffd45a] font-medium text-[#805027] hover:bg-[#ffe083]">{sheet?.state === "checkingIn" ? "กำลังเช็คอิน…" : "ตกลง"}</button>
    </div>
  </div>
{/if}

{#if showError}
  <div class="fixed inset-0 z-[60] bg-black/65" role="presentation"></div>
  <div class="fixed inset-0 z-[70] flex items-center justify-center px-5" role="presentation">
    <section role="alertdialog" aria-modal="true" aria-labelledby="checkin-error-title" aria-describedby="checkin-error-detail" class="w-full max-w-[400px] rounded-3xl bg-[#f1f5f9] px-6 pb-7 pt-8 text-center text-[#172943] shadow-2xl">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600" aria-hidden="true">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
      </div>
      <h2 id="checkin-error-title" class="mb-3 text-xl font-bold">{errorTitle}</h2>
      <p id="checkin-error-detail" class="mb-7 text-sm leading-relaxed text-[#52657d]">{errorMessage}</p>
      <button type="button" onclick={() => (showError = false)} class="h-12 w-full rounded-full bg-[#ffd45a] font-semibold text-[#805027] hover:bg-[#ffe083] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#805027]">ตกลง</button>
    </section>
  </div>
{/if}

