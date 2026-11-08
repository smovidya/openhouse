<script lang="ts">
  import type { PageProps } from "./$types";
  let { data }:PageProps=$props();
  const labels={valid:"เกียรติบัตรถูกต้อง",revoked:"เกียรติบัตรถูกเพิกถอน",invalid:"เกียรติบัตรไม่ถูกต้องหรือไม่อยู่ในระบบ",unavailable:"ไม่สามารถตรวจสอบสถานะได้ในขณะนี้"};
</script>
<svelte:head><title>ตรวจสอบเกียรติบัตร | Science Chula Open House</title><meta name="robots" content="noindex,nofollow"/><meta name="referrer" content="no-referrer"/></svelte:head>
<main class="min-h-dvh bg-[#f7f3e8] px-5 py-12 text-[#62462f]">
  <article class="mx-auto grid max-w-2xl gap-6 rounded-3xl border border-[#bca477] bg-white p-6 shadow-sm sm:p-12">
    <p class="text-xs tracking-widest">SCIENCE CHULA OPEN HOUSE · CERTIFICATE</p>
    <h1 class="text-2xl font-bold" class:text-red-700={data.status==='revoked'||data.status==='invalid'}>{labels[data.status]}</h1>
    {#if data.claims}
      <p class="break-words text-3xl font-medium">{data.claims.name.displayName}</p>
      {#if data.claims.name.school}<p class="break-words text-xl">{data.claims.name.school}</p>{/if}
      <p class="text-xl">{data.claims.event.title}</p>
      <dl class="grid gap-2 text-sm">
        <div><dt class="font-bold">ระยะเวลาจัดงาน</dt><dd>{data.claims.event.startsAt.slice(0,10)} – {data.claims.event.endsAt.slice(0,10)}</dd></div>
        <div><dt class="font-bold">วันที่มอบเกียรติบัตร</dt><dd>{data.claims.event.awardDate}</dd></div>
        <div><dt class="font-bold">ประเภท</dt><dd>เข้าร่วมงาน / Participation</dd></div>
        <div><dt class="font-bold">เลขที่เกียรติบัตร</dt><dd class="break-all">{data.claims.jti}</dd></div>
      </dl>
    {/if}
    {#if data.status==='unavailable'}<p role="alert">ลายเซ็นถูกต้อง แต่ยังตรวจสอบสถานะการเพิกถอนไม่ได้ กรุณาลองอีกครั้งภายหลัง</p>{/if}
    {#if data.status==='revoked'}<p>เกียรติบัตรฉบับนี้ไม่สามารถใช้ได้ กรุณาติดต่อผู้จัดงาน</p>{/if}
    <p class="border-t pt-5 text-sm">กรุณาเทียบชื่อและงานกับเกียรติบัตรที่ได้รับ ชื่อเป็นข้อมูลที่ผู้เข้าร่วมแจ้ง QR ยืนยันข้อมูลที่ออกโดยระบบ ไม่ยืนยันตัวบุคคลหรือทุกส่วนของไฟล์ PDF การตรวจสอบแบบออฟไลน์ยืนยันได้เฉพาะลายเซ็น สถานะการเพิกถอนต้องตรวจสอบผ่านเว็บไซต์</p>
  </article>
</main>
