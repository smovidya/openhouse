<script lang="ts">
  import * as Dialog from "#lib/components/ui/dialog/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import NameReview from "./name-review.svelte";
  import { getMyCertificate,confirmMyCertificateName,prepareMyCertificate } from "./certificates.remote";
  import type { CertificateState,Confirmation,RawName } from "./shared";
  let { initial }:{initial:CertificateState}=$props();
  let open=$state(false);
  let certificate=$state<CertificateState|null>(null);
  let raw=$state<RawName>({title:"mr",customTitle:"",firstName:"",lastName:"",school:""});
  let busy=$state(false);
  let problem=$state("");
  let attempt=0;
  const current=$derived(certificate??initial);
  async function recover() { const query=getMyCertificate(); await query.refresh(); if (!query.current) throw new Error("โหลดข้อมูลไม่สำเร็จ"); return query.current; }
  function changed(value:boolean) { attempt++; if (value) void load(attempt); }
  async function load(ticket:number) {
    busy=true; problem="";
    try {
      const next=await recover();
      if (ticket!==attempt) return;
      certificate=next; raw={...next.raw};
      if (next.issuance && next.issuance.status!=="revoked" && next.issuance.status!=="ready") await prepare(ticket);
    } catch { if (ticket===attempt) problem="ไม่สามารถโหลดเกียรติบัตรได้ กรุณาลองอีกครั้ง"; }
    finally { if(ticket===attempt) busy=false; }
  }
  async function prepare(ticket=attempt) {
    busy=true; problem="";
    try {
      const next=await prepareMyCertificate();
      if(ticket!==attempt) return;
      certificate=next;
      if(next.issuance?.status==='failed') problem="สร้างไฟล์ไม่สำเร็จ ชื่อที่ยืนยันแล้วถูกบันทึกไว้ กรุณาลองอีกครั้ง";
      if(next.issuance?.status==='generating') problem="ระบบกำลังสร้างเกียรติบัตร กรุณารอสักครู่แล้วลองอีกครั้ง";
    } catch { if(ticket===attempt) problem="เตรียมไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"; }
    finally { if(ticket===attempt) busy=false; }
  }
  async function confirm(input:Confirmation) {
    const ticket=attempt; busy=true; problem="";
    try {
      const next=await confirmMyCertificateName(input);
      if(ticket!==attempt) return;
      certificate=next; await prepare(ticket);
    } catch (cause) {
      if(ticket!==attempt) return;
      // A lost response may follow a committed issuance: recover before allowing edits.
      try { const next=await recover(); if(ticket===attempt) certificate=next; } catch { if(ticket===attempt) certificate=null; }
      const detail = (cause as {body?:{message?:string};message?:string})?.body?.message ?? (cause as Error)?.message;
      if(ticket===attempt) problem=detail && /^[ก-๛]/u.test(detail) ? detail : "ยืนยันไม่สำเร็จหรือข้อมูลเปลี่ยนแปลง กรุณาตรวจสอบสถานะอีกครั้ง ชื่อที่บันทึกแล้วจะแก้ไขเองไม่ได้";
    } finally { if(ticket===attempt) busy=false; }
  }
</script>
<Dialog.Root bind:open onOpenChange={changed}>
  <Dialog.Trigger class="inline-flex justify-center rounded-full bg-brand-yellow px-5 py-2 font-heading text-brand-brown focus-visible:ring-3" disabled={!initial.eligible&&!initial.issuance}>รับเกียรติบัตร</Dialog.Trigger>
  <Dialog.Content overlayClass="bg-black/50 motion-reduce:animate-none" class="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-[#faf5e8] p-6 text-brand-brown motion-reduce:animate-none sm:p-8">
    <Dialog.Header class="pr-7"><Dialog.Title class="text-2xl">{!busy && current.issuance ? 'เกียรติบัตรของคุณ' : 'ตรวจสอบข้อมูลของคุณ'}</Dialog.Title><Dialog.Description class="text-brand-brown/80">Science Chula Open House 2027</Dialog.Description></Dialog.Header>
    <div role="status" aria-live="polite" aria-atomic="true">{#if busy}<div class="grid justify-items-center gap-4 py-8"><span class="size-10 animate-spin rounded-full border-4 border-brand-brown/20 border-t-brand-brown motion-reduce:animate-none" aria-hidden="true"></span><p>กำลังตรวจสอบข้อมูล</p></div>{/if}</div>
    {#if !busy}
      {#if problem}<p role="alert" class="rounded-lg bg-red-50 p-3 text-red-800">{problem}</p>{/if}
      {#if problem && !certificate}
        <Button variant="cta" onclick={()=>load(++attempt)}>ตรวจสอบสถานะอีกครั้ง</Button>
      {:else if current.issuance?.status==='revoked'}
        <p role="alert">เกียรติบัตรนี้ถูกเพิกถอนและไม่สามารถดาวน์โหลดได้ กรุณาติดต่อผู้จัดงานเพื่อขอความช่วยเหลือ</p>
      {:else if current.issuance}
        <div class="rounded-xl border-2 border-[#c6ab75] bg-white p-6 text-center"><p class="text-xs">เกียรติบัตรการเข้าร่วมงาน</p><p class="my-5 break-words text-2xl text-[#927025]">{current.issuance.name.displayName}</p>{#if current.issuance.name.school}<p class="mb-3 break-words">{current.issuance.name.school}</p>{/if}<p>{current.issuance.event.title}</p><p class="mt-2 text-sm">วันที่มอบ {current.issuance.event.awardDate}</p></div>
        {#if current.issuance.status==='ready'}
          <Button variant="cta" size="cta-sm" href="/certificate/download" download>ดาวน์โหลดเกียรติบัตร</Button><a href="/certificate/download" download class="text-center text-sm underline">หากดาวน์โหลดไม่สำเร็จ กดที่นี่เพื่อลองอีกครั้ง</a>
        {:else}<Button variant="cta" onclick={()=>prepare()}>ลองเตรียมไฟล์อีกครั้ง</Button>{/if}
        <p class="text-xs">ชื่อถูกยืนยันแล้ว หากต้องการแก้ไขกรุณาติดต่อผู้จัดงาน</p>
      {:else if !current.eligible}<p>กรุณาเช็คอินจุดลงทะเบียนเข้างานและส่งแบบประเมินก่อน</p>
      {:else if !current.configured}<p>ระบบเกียรติบัตรยังไม่พร้อม กรุณาลองภายหลัง</p><Button variant="cta" onclick={()=>load(++attempt)}>ตรวจสอบอีกครั้ง</Button>
      {:else}<NameReview bind:raw onconfirm={confirm} oncancel={()=>{attempt++;open=false;}}/>{/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>
