<script lang="ts">
  import * as Dialog from "#lib/components/ui/dialog/index.js";
  import { souvenirTiers, type SouvenirStats } from "#lib/features/dashboard/souvenirs.ts";

  let { open = $bindable(false), stats, error = false }: { open?: boolean; stats?: SouvenirStats; error?: boolean } = $props();
  const number = new Intl.NumberFormat("th-TH");
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger class="rounded-lg border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-2 text-sm font-medium text-brand-yellow transition-colors hover:bg-brand-yellow/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-yellow">
    ของที่ระลึก · ดูสถิติแต่ละระดับ
  </Dialog.Trigger>
  <Dialog.Content class="max-h-[90dvh] overflow-y-auto border border-white/15 bg-brand-navy text-white sm:max-w-3xl">
    <Dialog.Header>
      <Dialog.Title class="text-xl text-brand-yellow">ของที่ระลึก</Dialog.Title>
      <Dialog.Description class="text-white/65">จำนวนผู้ผ่านเงื่อนไขและรับรางวัลแล้ว แยกตามระดับ</Dialog.Description>
    </Dialog.Header>
    {#if error}
      <p role="alert" class="text-amber-200">โหลดสถิติไม่สำเร็จ กำลังลองใหม่อัตโนมัติ</p>
    {/if}
    {#if stats}
      <p class="text-xs leading-relaxed text-white/60">นับผู้เข้าร่วมทุกประเภทจากการสแกนกิจกรรมจริง ระดับพื้นฐานใช้การสแกนเข้างาน แต่ละคนมีสิทธิ์ได้หลายระดับ จึงไม่ควรนำยอดแต่ละระดับมารวมกัน</p>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each souvenirTiers as tier, index (tier.id)}
          {@const count = stats.tiers.find(row => row.id === tier.id)}
          <article class="rounded-xl border border-white/15 bg-white/5 p-4">
            <div class="mb-3 flex items-start gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-yellow text-lg font-bold text-brand-navy" aria-hidden="true">{index === 0 ? '★' : 4 - index}</span>
              <div><h3 class="font-medium text-brand-yellow">{tier.title}</h3><p class="text-sm">{tier.prize}</p></div>
            </div>
            <p class="min-h-12 text-xs leading-relaxed text-white/65">{tier.condition}</p>
            <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <div><dt class="text-xs text-white/60">ผ่านเงื่อนไข</dt><dd class="mt-1 text-3xl font-medium tabular-nums">{number.format(count?.eligible ?? 0)} <span class="text-xs font-normal text-white/50">คน</span></dd></div>
              <div><dt class="text-xs text-emerald-200">รับรางวัลแล้ว</dt><dd class="mt-1 text-3xl font-medium text-emerald-200 tabular-nums">{count?.redeemed == null ? '—' : number.format(count.redeemed)} <span class="text-xs font-normal text-white/50">คน</span></dd></div>
            </dl>
            {#if count?.redeemed == null}<p class="mt-3 text-xs text-amber-200">ยังไม่มีจุดรับรางวัลที่ระบุระดับนี้</p>{/if}
          </article>
        {/each}
      </div>
      {#if stats.unmappedCheckpoints.length || stats.unmappedRedemptions}
        <p class="rounded-lg border border-amber-200/20 bg-amber-200/10 p-3 text-xs leading-relaxed text-amber-100">ยังระบุระดับไม่ได้: {stats.unmappedCheckpoints.join(' · ') || 'จุดรับรางวัลอื่น'} (ผู้รับ {number.format(stats.unmappedRedemptions)} คน) กรุณาตั้งชื่อจุดรับรางวัลให้ตรงกับชื่อระดับหรือของรางวัล</p>
      {/if}
      <p class="text-xs text-white/45">อัปเดต {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(stats.updatedAt))} น. · อัปเดตทุก 10 วินาทีขณะเปิด</p>
    {:else if !error}
      <p role="status" class="py-8 text-center text-white/60">กำลังโหลดสถิติของที่ระลึก…</p>
    {/if}
  </Dialog.Content>
</Dialog.Root>
