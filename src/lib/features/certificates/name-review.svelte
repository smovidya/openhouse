<script lang="ts">
  import { Input } from "#lib/components/ui/input/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import { prefixOptions } from "#lib/registration/options.ts";
  import { CERTIFICATE_EVENT, reviewName, type RawName, type NameSnapshot, type Confirmation } from "./shared";
  let { raw=$bindable(), onconfirm, oncancel, actionLabel="ยืนยัน" }: { raw:RawName; onconfirm:(input:Confirmation)=>Promise<void>; oncancel:()=>void; actionLabel?:string }=$props();
  const uid=$props.id();
  let reviewed=$state<NameSnapshot|null>(null);
  let message=$state("");
  const corrections=$derived(reviewed ? [
    { label:"คำนำหน้า",original:raw.customTitle,corrected:reviewed.title,show:raw.title==="other" },
    { label:"สถานศึกษา",original:raw.school,corrected:reviewed.school,show:true },
    { label:"ชื่อ",original:raw.firstName,corrected:reviewed.firstName,show:true },
    { label:"นามสกุล",original:raw.lastName,corrected:reviewed.lastName,show:true },
  ].filter((item)=>item.show && item.original!==item.corrected):[]);
  function edited() { reviewed=null; message=""; }
  async function submit(event:SubmitEvent) {
    event.preventDefault(); message="";
    try {
      if (!reviewed) { reviewed=reviewName(raw); return; }
      await onconfirm({raw:{...raw},reviewed:{...reviewed}});
    } catch (cause) { message=cause instanceof Error ? cause.message : "กรุณาลองอีกครั้ง"; }
  }
</script>
<form onsubmit={submit} class="grid gap-4 text-left">
  <div class="grid gap-1.5"><Label for={`${uid}-title`}>คำนำหน้า</Label>
    <select id={`${uid}-title`} bind:value={raw.title} onchange={edited} required autocomplete="honorific-prefix" class="h-11 w-full rounded-lg border border-brand-brown/20 bg-white px-3 text-base">
      {#each prefixOptions as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
    </select>
  </div>
  {#if raw.title==='other'}<div class="grid gap-1.5"><Label for={`${uid}-custom`}>คำนำหน้าอื่น ๆ</Label><Input id={`${uid}-custom`} bind:value={raw.customTitle} oninput={edited} maxlength={120} required autocomplete="honorific-prefix" class="bg-white text-brand-brown"/></div>{/if}
  <div class="grid gap-1.5"><Label for={`${uid}-first`}>ชื่อ</Label><Input id={`${uid}-first`} bind:value={raw.firstName} oninput={edited} maxlength={120} required autocomplete="given-name" class="bg-white text-brand-brown"/></div>
  <div class="grid gap-1.5"><Label for={`${uid}-last`}>นามสกุล</Label><Input id={`${uid}-last`} bind:value={raw.lastName} oninput={edited} maxlength={120} required autocomplete="family-name" class="bg-white text-brand-brown"/></div>
  <div class="grid gap-1.5"><Label for={`${uid}-school`}>สถานศึกษา (ถ้ามี)</Label><Input id={`${uid}-school`} bind:value={raw.school} oninput={edited} maxlength={180} autocomplete="organization" class="bg-white text-brand-brown"/></div>
  <p class="text-sm">กรุณาตรวจสอบคำนำหน้า ชื่อ และนามสกุล ระบบจะปรับรูปอักษรก่อนให้ยืนยัน ชื่อและสถานศึกษาจะปรากฏบนเกียรติบัตรและหน้าตรวจสอบสาธารณะ ข้อมูลนี้ใช้เฉพาะเกียรติบัตร</p>
  {#if reviewed}
    {#if corrections.length}<div class="rounded-lg border border-amber-600/30 bg-amber-50 p-3 text-sm" role="status"><p class="font-bold">มีการปรับรูปอักษร กรุณาตรวจสอบ</p>{#each corrections as item (item.label)}<p class="break-words">{item.label}: <span class="whitespace-pre-wrap">“{item.original}”</span> → “{item.corrected}”</p>{/each}</div>{/if}
    <div class="rounded-xl border-2 border-[#c6ab75] bg-white p-5 text-center" role="status">
      <p class="text-xs tracking-wider">เกียรติบัตรการเข้าร่วมงาน</p><p class="my-4 break-words text-2xl font-medium text-[#927025]">{reviewed.displayName}</p>{#if reviewed.school}<p class="mb-3 break-words">{reviewed.school}</p>{/if}<p>{CERTIFICATE_EVENT.title}</p><p class="mt-1 text-xs">31 ตุลาคม – 1 พฤศจิกายน 2569 · มอบวันที่ 1 พฤศจิกายน 2569</p>
    </div>
    <p id={`${uid}-lock`} class="text-sm font-medium">เมื่อกด “{actionLabel}” ชื่อและสถานศึกษาที่แสดงด้านบนจะถูกล็อก การแก้ไขภายหลังต้องติดต่อผู้จัดงาน</p>
  {/if}
  {#if message}<p role="alert" class="text-sm text-red-800">{message}</p>{/if}
  <div class="grid grid-cols-2 gap-3"><Button variant="cta-light" size="cta-sm" onclick={oncancel}>ยกเลิก</Button><Button type="submit" variant="cta" size="cta-sm" aria-describedby={reviewed ? `${uid}-lock` : undefined}>{reviewed ? actionLabel : 'ตรวจสอบชื่อ'}</Button></div>
</form>
