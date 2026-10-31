<script lang="ts">
  import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
  import checkCircleIcon from "#lib/assets/icons/check-circle.svg";
  import refreshIcon from "#lib/assets/icons/refresh.svg";
  import Glass from "#lib/render/glass.svelte";
  import QrCode from "#lib/components/qr-code.svelte";
  import RewardTierCard from "#lib/components/reward-tier-card.svelte";
  import SignBoard from "#lib/components/sign-board.svelte";
  import StampLog from "#lib/components/stamp-log.svelte";
  import WorkshopCard from "#lib/components/workshop-card.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { BANGKOK_TIME_ZONE, EVENT_SCHEDULE } from "#lib/constants/time.ts";
  import { getMyProgress } from "#lib/features/checkpoints/checkpoints.remote.ts";
  import {
    entryReward,
    rewardHashtags,
    rewardTiers,
    tierConditions,
  } from "#lib/rewards.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // The stamp map reads scans made at booths, so it can go stale while the page stays open;
  // the refresh button re-runs getMyProgress instead of reloading the whole page.
  const progressQuery = getMyProgress();
  const progress = $derived(progressQuery.current ?? data.progress);
  let refreshing = $state(false);
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      await progressQuery.refresh();
    } finally {
      refreshing = false;
    }
  }

  const registrationOpensLabel = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(new Date(EVENT_SCHEDULE.workshopRegistrationOpensAt));

  const remaining = $derived(
    Math.max(0, data.workshopLimit - data.advanceCount),
  );
</script>

<svelte:head>
  <title>MY QR CODE | Science Chula Openhouse</title>
</svelte:head>

<main
  class="mx-auto flex w-full max-w-[402px] flex-col items-center gap-8 px-3 pt-6 pb-4"
>
  <SignBoard title="MY QR CODE" wide />

  <Glass
    as="section"
    variant="light"
    options={{ vibrancy: 1.2 }}
    class="rounded-xl flex flex-col gap-2 p-4 text-center text-black"
  >
    <QrCode value={data.profile.code} class="size-[227px]" />
    <div>
      <p class="text-xl">{data.profile.name}</p>
      <p class="text-sm">{data.profile.code}</p>
    </div>
  </Glass>

  <Glass
    as="section"
    options={{ vibrancy: 1.2 }}
    variant="light"
    class="w-full rounded-xl flex flex-col gap-1 p-4 text-center"
  >
    <h2 class="text-xl font-medium text-brand-navy">
      เกียรติบัตรการเข้าร่วมงาน
    </h2>
    {#if progress?.entered}
      <p class="text-xs text-brand-navy">
        เช็คอินจุดลงทะเบียนเข้างานแล้ว <svg
          viewBox="0 0 18 18"
          role="img"
          aria-label="✓"
          class="inline size-4 align-middle"
        >
          <circle cx="9" cy="9" r="7.5" class="fill-status-green" />
          <path
            d="M5.8 9.2 7.95 11.35 12.2 7.1"
            fill="none"
            stroke="white"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg> มีสิทธิ์ได้รับเกียรติบัตรนี้
      </p>
    {:else}
      <p class="text-xs text-brand-mist">
        เช็คอินที่จุดลงทะเบียนในวันงานเท่านั้น จึงจะได้รับเกียรติบัตรนี้
      </p>
    {/if}
    <p class="text-xs text-brand-navy">กรุณารอติดตามประกาศภายหลัง</p>
  </Glass>

  <section class="flex w-full flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-col text-brand-navy">
        <h2 class="text-2xl font-medium">My Workshops</h2>
        <p class="flex items-center gap-1 text-xs">
          เวิร์กช็อปที่ลงทะเบียนแล้ว ({data.advanceCount}/{data.workshopLimit})
          <img src={checkCircleIcon} alt="" />
        </p>
      </div>
      <Button variant="cta" size="cta-sm" href="/workshop">
        ดูทั้งหมด
        <img src={arrowRightIcon} alt="" />
      </Button>
    </div>

    {#if data.workshopRegistrationOpened}
      {#each data.workshops as workshop (workshop.id)}
        <WorkshopCard {workshop} />
      {/each}

      {#if remaining > 0 && !data.workshopRegistrationClosed}
        <Glass class="rounded-lg flex flex-col items-center gap-2 p-3">
          <p class="text-center text-xs text-brand-mist">
            คุณลงทะเบียนได้อีก {remaining} เวิร์กช็อป
          </p>
          <Button variant="cta" size="cta-sm" href="/workshop"
            >ลงทะเบียนเพิ่ม</Button
          >
        </Glass>
      {/if}
    {:else}
      <!-- Placeholder until workshop registration opens (like the reward hunt's). -->
      <Glass class="rounded-lg p-3">
        <p
          class="text-center font-heading text-base font-medium text-brand-yellow"
        >
          เตรียมพบกับการลงทะเบียนเวิร์กช็อป<br />Coming Soon!!
        </p>
        <p class="mt-2 text-center text-sm text-brand-mist">
          เปิดลงทะเบียน <time
            datetime={EVENT_SCHEDULE.workshopRegistrationOpensAt}
            >{registrationOpensLabel} น.</time
          >
        </p>
      </Glass>
    {/if}
  </section>

  <section class="flex w-full flex-col gap-2">
    <div class="flex items-start justify-between gap-2">
      <div class="text-brand-navy">
        <h2 class="text-2xl font-medium">ภารกิจล่าของรางวัล</h2>
        <p class="text-xs">
          *แลกของรางวัลได้ครั้งเดียว
          เมื่อแลกแล้วจะสะสมกิจกรรมเพื่อเลื่อนขั้นต่อไม่ได้
        </p>
        <p class="text-xs">ลงทะเบียนเข้างานรับ{entryReward}ทันที</p>
      </div>
      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full border border-brand-sky/40 bg-brand-mist text-brand-navy transition-colors hover:bg-brand-sky/20 disabled:opacity-50"
        aria-label="รีเฟรชตราแสตมป์"
        disabled={refreshing}
        onclick={refresh}
      >
        <img
          src={refreshIcon}
          alt=""
          class="size-4 {refreshing ? 'animate-spin' : ''}"
        />
      </button>
    </div>
    {#if progress}
      <StampLog
        checkpoints={progress.checkpoints}
        registered={data.workshops.map((workshop) => ({
          slug: workshop.slug,
          title: workshop.title,
          type: workshop.type,
        }))}
      />
    {/if}
    <!-- Redemptions from before gift names were recorded have none: show the generic status then. -->
    {#if progress?.redemption}
      <p class="text-sm text-brand-navy">
        {progress.redemption.giftName
          ? `แลก${progress.redemption.giftName}แล้ว`
          : "แลกรับของรางวัลแล้ว"}
      </p>
    {/if}
    {#each rewardTiers as tier (tier.tier)}
      <RewardTierCard
        tier={{
          title: tier.title,
          conditions: tierConditions(tier, progress?.counts ?? null),
          rewards: tier.rewards,
        }}
      />
    {/each}
    <p class="text-xs text-brand-navy">
      *ก่อนรับของรางวัล ลงสตอรี่พร้อมแฮชแท็ก {rewardHashtags.join(" และ ")}
    </p>
  </section>
</main>
