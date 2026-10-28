<script lang="ts">
  import { goto } from '$app/navigation';

  type Mode = 'scan' | 'manual';
  type Booth = { id: string; name: string };

  let mode = $state<Mode>('scan');
  let menuOpen = $state(false);
  let boothOpen = $state(true);
  let selectedBooth = $state('');
  let ticketCode = $state('');
  let showConfirm = $state(false);
  let showError = $state(false);
  let errorTitle = $state('ไม่สามารถเช็คอินได้');
  let errorMessage = $state('');
  let savedNotice = $state('');

  // Demo only
  const demoValidCodes = new Set(['DEMO-001', 'DEMO-002']);
  const completedCheckins = new Set<string>();
  const qrDemoCode = 'DEMO-001';

  const booths: Booth[] = [
    { id: '1', name: 'Mathematics and computer science 1' },
    { id: '2', name: 'Mathematics and computer science 2' },
    { id: '3', name: 'Mathematics and computer science 3' }
  ];

  let selectedBoothName = $derived(
    booths.find((booth) => booth.id === selectedBooth)?.name ?? 'กรุณาเลือกบูธ'
  );

  let currentCode = $state('');

  function showCheckinError(title: string, detail: string) {
    errorTitle = title;
    errorMessage = detail;
    showConfirm = false;
    showError = true;
    savedNotice = '';
  }

  function openConfirmation() {
    savedNotice = '';
    const code = mode === 'scan' ? qrDemoCode : ticketCode.trim().toUpperCase();

    if (mode === 'manual' && !code) {
      showCheckinError('กรุณากรอกรหัส', 'กรุณากรอกรหัสของผู้ร่วมงานก่อนเช็คอิน');
      return;
    }
    if (!selectedBooth) {
      showCheckinError('กรุณาเลือกบูธ', 'กรุณาเลือกบูธนิทรรศการที่ต้องการเช็คอิน');
      return;
    }
    if (code === 'DEMO-SERVER') {
      showCheckinError('เกิดข้อผิดพลาดของระบบ', 'ไม่สามารถเชื่อมต่อระบบเช็คอินได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }
    if (!demoValidCodes.has(code)) {
      showCheckinError('ไม่พบรหัสผู้เข้าร่วมงาน', 'รหัสนี้ไม่อยู่ในรายการตัวอย่าง กรุณาตรวจสอบรหัสอีกครั้ง');
      return;
    }
    if (completedCheckins.has(`${code}:${selectedBooth}`)) {
      showCheckinError('เช็คอินซ้ำ', 'ผู้เข้าร่วมงานนี้เช็คอินบูธดังกล่าวแล้ว');
      return;
    }

    currentCode = code;
    showConfirm = true;
  }

  function confirmCheckin() {
    // Re-check right before confirming to prevent duplicate demo submissions.
    if (!selectedBooth) {
      showCheckinError('กรุณาเลือกบูธ', 'กรุณาเลือกบูธนิทรรศการที่ต้องการเช็คอิน');
      return;
    }
    if (completedCheckins.has(`${currentCode}:${selectedBooth}`)) {
      showCheckinError('เช็คอินซ้ำ', 'ผู้เข้าร่วมงานนี้เช็คอินบูธดังกล่าวแล้ว');
      return;
    }
    completedCheckins.add(`${currentCode}:${selectedBooth}`);
    showConfirm = false;
    savedNotice = `ตัวอย่าง: เช็คอิน ${selectedBoothName} สำเร็จ (ข้อมูลเก็บเฉพาะในหน้านี้ ยังไม่ได้บันทึกลงเซิร์ฟเวอร์)`;
  }
</script>

<svelte:head>
  <title>เช็คอินบูธนิทรรศการ | Open House</title>
  <meta name="description" content="เช็คอินบูธนิทรรศการ Open House" />
</svelte:head>

<div class="min-h-screen bg-[#243e65] text-white">

  <main class="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-[450px] flex-col px-4 pb-12 pt-8 sm:px-6">
    <h1 class="mb-7 text-center text-[27px] font-medium text-[#ffd65e]">เช็คอินบูธนิทรรศการ</h1>

    <div class="mx-auto mb-7 flex h-11 w-full max-w-[265px] overflow-hidden rounded-full bg-[#f2f5f8] p-[2px] text-[#6d3b22]">
      <button type="button" onclick={() => (mode = 'scan')} class:active-tab={mode === 'scan'} class="flex w-1/2 items-center justify-center gap-1 rounded-full text-[13px] transition-colors">
        <span aria-hidden="true">▦</span> สแกน
      </button>
      <button type="button" onclick={() => (mode = 'manual')} class:active-tab={mode === 'manual'} class="flex w-1/2 items-center justify-center gap-1 rounded-full text-[13px] transition-colors">
        <span aria-hidden="true">▤</span> กรอกรหัส
      </button>
    </div>

    {#if mode === 'scan'}
      <section class="mb-8 flex flex-col items-center gap-3" aria-label="QR check-in demonstration">
        <div class="qr-frame relative flex aspect-square w-[min(74vw,290px)] items-center justify-center p-4">
          <img src="/qr-demo.png" alt="QR code ตัวอย่างสำหรับทดสอบหน้าจอ" class="aspect-square h-full w-full object-contain" />
        </div>
        <button type="button" onclick={openConfirmation} class="rounded-full bg-[#ffd45a] px-5 py-2 text-sm font-medium text-[#70431f] hover:bg-[#ffe083]">
          จำลองการสแกน QR
        </button>
        <p class="text-center text-xs text-[#afc4dd]">QR ตัวอย่าง: DEMO-001 — ยังไม่ได้เปิดกล้องจริง</p>
      </section>
    {:else}
      <section class="mb-9 space-y-4">
        <label for="ticketCode" class="block text-center text-sm text-[#f4ca63]">กรอกรหัสของผู้ร่วมงาน</label>
        <input id="ticketCode" name="ticketCode" bind:value={ticketCode} type="text" autocomplete="off" class="h-12 w-full rounded-md border border-[#a6c5df] bg-[#f2f7fa] px-4 text-[#334155] outline-none focus:border-[#ffd45a] focus:ring-2 focus:ring-[#ffd45a]/50" />
        <p class="text-center text-xs text-[#afc4dd]">ทดลองใช้ DEMO-001 หรือ DEMO-002 · DEMO-SERVER เพื่อจำลองข้อผิดพลาด</p>
        <div class="flex justify-center">
          <button type="button" onclick={openConfirmation} class="rounded-full bg-[#ffd45a] px-5 py-2 text-sm font-medium text-[#72451e] hover:bg-[#ffe083]">ลงทะเบียน</button>
        </div>
      </section>
    {/if}

    <section class="mt-1">
      <h2 class="mb-3 text-lg font-medium text-[#a8c2da]">เลือกบูธนิทรรศการ</h2>
      <div class="overflow-hidden rounded-lg border border-[#a9c5e2] bg-[#f2f7fa] text-[#596b86]">
        <button type="button" aria-expanded={boothOpen} onclick={() => (boothOpen = !boothOpen)} class="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm">
          <span class="truncate">{selectedBoothName}</span>
          <svg class:rotate-180={boothOpen} class="shrink-0 transition-transform" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#243e65" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {#if boothOpen}
          <div class="px-3 pb-2">
            {#each booths as booth}
              <label class="flex cursor-pointer items-center justify-between gap-2 border-t border-[#a9c5e2] py-2 text-sm">
                <span>{booth.name}</span>
                <input type="radio" name="booth" value={booth.id} bind:group={selectedBooth} class="h-4 w-4 shrink-0 accent-[#243e65]" />
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    {#if savedNotice}
      <p role="status" class="mt-5 rounded-lg bg-green-900/30 p-3 text-center text-sm text-green-100">{savedNotice}</p>
    {/if}

    <button type="button" onclick={() => goto('/checkin/history')} class="mx-auto mt-9 rounded-full bg-[#f9fafb] px-6 py-2 text-sm font-medium text-[#84553c] hover:bg-white">
      ดูประวัติการเช็คอิน →
    </button>
  </main>
</div>

{#if showConfirm}
  <div class="fixed inset-0 z-40 bg-black/55" role="presentation"></div>
  <div class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[26px] bg-[#edf3f8] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-10 text-[#1a1a1a] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <button type="button" aria-label="ปิด" onclick={() => (showConfirm = false)} class="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe5ea] text-2xl text-[#4b5563]">×</button>
    <h2 id="confirm-title" class="mb-7 text-center text-[26px] font-semibold">เช็คอินผู้เข้าร่วมงาน</h2>
    <p class="mb-4 text-center text-xs text-[#64748b]">ข้อมูลผู้เข้าร่วมด้านล่างเป็นตัวอย่าง ไม่ได้ดึงจากระบบจริง</p>
    <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-4 text-[15px] sm:grid-cols-[130px_1fr]">
      <dt class="text-[#45658d]">รหัส</dt><dd>{currentCode}</dd>
      <dt class="text-[#45658d]">ชื่อ</dt><dd>ผู้ร่วมงานตัวอย่าง</dd>
      <dt class="text-[#45658d]">สถานะ</dt><dd>ข้อมูลสาธิต</dd>
    </dl>
    <div class="my-6 h-px bg-[#96bbda]"></div>
    <dl class="grid grid-cols-[110px_1fr] gap-3 text-[16px] sm:grid-cols-[130px_1fr]">
      <dt class="text-[#45658d]">บูธนิทรรศการ</dt><dd class="leading-relaxed">{selectedBoothName}</dd>
    </dl>
    <div class="mt-12 flex flex-col gap-3">
      <button type="button" onclick={() => (showConfirm = false)} class="h-14 rounded-full border border-[#81513b] font-medium text-[#81513b]">ยกเลิก</button>
      <button type="button" onclick={confirmCheckin} class="h-14 rounded-full bg-[#ffd45a] font-medium text-[#805027] hover:bg-[#ffe083]">ตกลง</button>
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

<style>
  .active-tab { background: #ffd45a; border: 1px solid #88582f; box-shadow: 0 1px 2px #0002; }
  .qr-frame::before, .qr-frame::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 8px; }
  .qr-frame::before { border: 9px solid transparent; border-top-color: #080b10; border-left-color: #080b10; clip-path: polygon(0 0, 37% 0, 37% 11%, 11% 11%, 11% 37%, 0 37%); }
  .qr-frame::after { border: 9px solid transparent; border-bottom-color: #080b10; border-right-color: #080b10; clip-path: polygon(63% 89%, 89% 89%, 89% 63%, 100% 63%, 100% 100%, 63% 100%); }
</style>
