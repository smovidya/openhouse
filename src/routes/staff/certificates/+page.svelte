<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";
  import NameReview from "#lib/features/certificates/name-review.svelte";
  import { adminLookupCertificate,adminRevokeCertificate,adminReplaceCertificate } from "#lib/features/certificates/certificates.remote.ts";
  import type { RawName,Confirmation } from "#lib/features/certificates/shared.ts";
  let lookup=$state("");
  let result=$state<Awaited<ReturnType<typeof adminLookupCertificate>>|null>(null);
  let message=$state("");
  let busy=$state(false);
  let reason=$state("");
  let replacing=$state(false);
  let raw=$state<RawName>({title:"mr",customTitle:"",firstName:"",lastName:"",school:""});
  const current=$derived(result?.history.find((row)=>row.id===result?.currentId));
  async function search(event?:SubmitEvent) {
    event?.preventDefault(); busy=true; message=""; replacing=false;
    try { const query=adminLookupCertificate(lookup.trim()); await query.refresh(); result=query.current??null; if(!result) message="ไม่พบเกียรติบัตร"; }
    catch { message="ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง"; }
    finally { busy=false; }
  }
  async function revoke() {
    if(!current||!reason.trim()) return;
    busy=true; message="";
    try { await adminRevokeCertificate({id:current.id,reason:reason.trim()}); await search(); reason=""; }
    catch { message="เพิกถอนไม่สำเร็จ กรุณาค้นหาสถานะล่าสุดก่อนลองอีกครั้ง"; }
    finally { busy=false; }
  }
  async function replace(confirmation:Confirmation) {
    if(!current||!reason.trim()) throw new Error("กรุณาระบุเหตุผล");
    busy=true; message="";
    try { await adminReplaceCertificate({id:current.id,reason:reason.trim(),confirmation}); await search(); reason=""; }
    catch { message="แทนที่ไม่สำเร็จ กรุณาค้นหาสถานะล่าสุดและตรวจสอบชื่ออีกครั้ง"; }
    finally { busy=false; }
  }
</script>
<svelte:head><title>จัดการเกียรติบัตร | ผู้ดูแลระบบ</title><meta name="robots" content="noindex"/></svelte:head>
<main class="mx-auto my-8 grid w-[calc(100%-2rem)] max-w-2xl gap-6 rounded-2xl bg-[#faf5e8] p-6 text-brand-brown">
  <h1 class="text-2xl">จัดการเกียรติบัตร</h1>
  <form onsubmit={search} class="grid gap-2"><Label for="certificate-lookup">รหัส QR ผู้เข้าร่วม หรือเลขที่เกียรติบัตร / ฉบับ</Label><Input id="certificate-lookup" bind:value={lookup} required maxlength={120}/><Button type="submit" variant="cta" disabled={busy}>ค้นหา</Button></form>
  <p role="status" aria-live="polite">{busy?'กำลังดำเนินการ':message}</p>
  {#if current}
    <p class="break-words text-2xl">{current.name.displayName}</p><p>สถานะ: {current.status}</p>
    <div class="grid gap-2"><Label for="certificate-reason">เหตุผลในการเพิกถอน / ออกฉบับแทน (บันทึกพร้อมผู้ดูแลและเวลา)</Label><Input id="certificate-reason" bind:value={reason} maxlength={500} required/></div>
    <p class="text-sm">การเพิกถอนทำให้ QR เดิมใช้ไม่ได้ แต่ไม่สามารถลบไฟล์ที่ดาวน์โหลดแล้ว การออกฉบับแทนจะเพิกถอนฉบับเดิมโดยอัตโนมัติ</p>
    {#if !replacing}<div class="flex flex-wrap gap-3"><Button variant="destructive" disabled={busy||!reason.trim()||current.status==='revoked'} onclick={revoke}>เพิกถอนฉบับนี้</Button><Button variant="cta" disabled={busy||!reason.trim()} onclick={()=>{raw={title:'other',customTitle:current!.name.title,firstName:current!.name.firstName,lastName:current!.name.lastName,school:current!.name.school};replacing=true;}}>ออกฉบับแทน</Button></div>
    {:else if !busy}<NameReview bind:raw onconfirm={replace} oncancel={()=>replacing=false} actionLabel="ยืนยันออกฉบับแทน"/>{/if}
    <h2 class="text-xl">ประวัติฉบับเกียรติบัตร</h2><ul class="grid gap-3">{#each result?.history??[] as row (row.id)}<li class="rounded-lg border border-brand-brown/20 p-3"><p>{row.name.displayName}</p>{#if row.name.school}<p>{row.name.school}</p>{/if}<p class="break-all text-xs">{row.id}</p><p class="text-sm">{row.status} · {new Date(row.createdAt*1000).toISOString()}</p>{#if row.createdBy}<p class="text-xs">ออกฉบับแทนโดย {row.createdBy} · {row.replacementReason}</p>{/if}
      {#if row.revokedBy}<p class="text-xs">เพิกถอนโดย {row.revokedBy} · {row.revokedAt ? new Date(row.revokedAt*1000).toISOString() : ''}</p>{/if}
      {#if row.reason}<p class="text-sm">เหตุผล: {row.reason}</p>{/if}</li>{/each}</ul>
  {/if}
</main>
