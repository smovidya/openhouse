<script lang="ts">
  import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
  import refreshIcon from "#lib/assets/icons/refresh.svg";
  import bagFull from "#lib/assets/rewards/bag-full.webp";
  import bagThumb from "#lib/assets/rewards/bag.webp";
  import capFull from "#lib/assets/rewards/cap-full.webp";
  import capThumb from "#lib/assets/rewards/cap.webp";
  import notebookFull from "#lib/assets/rewards/notebook-full.webp";
  import notebookThumb from "#lib/assets/rewards/notebook.webp";
  import pillowFull from "#lib/assets/rewards/pillow-full.webp";
  import pillowThumb from "#lib/assets/rewards/pillow.webp";
  import tumblerFull from "#lib/assets/rewards/tumbler-full.webp";
  import tumblerThumb from "#lib/assets/rewards/tumbler.webp";
  import Glass from "#lib/render/glass.svelte";
  import QrCode from "#lib/components/qr-code.svelte";
  import RewardTierCard from "#lib/components/reward-tier-card.svelte";
  import SignBoard from "#lib/components/sign-board.svelte";
  import StampLog from "#lib/components/stamp-log.svelte";
  import WorkshopCard from "#lib/components/workshop-card.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { BANGKOK_TIME_ZONE, EVENT_SCHEDULE } from "#lib/constants/time.ts";
  import { getMyProgress } from "#lib/features/checkpoints/checkpoints.remote.ts";
  import { rewardHashtags, rewardTiers, tierConditions } from "#lib/rewards.js";
  import type { PageProps } from "./$types";

  // Photos from the souvenir team's handbook ("ของที่ระลึก"), in each tier's reward order.
  const tierImages = {
    3: [{ thumb: pillowThumb, full: pillowFull }],
    2: [{ thumb: capThumb, full: capFull }],
    1: [{ thumb: tumblerThumb, full: tumblerFull }],
  } as const;

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

  /** Handed out at the registration point on entry: a card like the tiers', above them. */
  const entryTier = $derived({
    title: "ระดับพื้นฐาน",
    conditions: [
      {
        label: "ลงทะเบียนเข้างาน",
        done: progress ? Number(progress.entered) : null,
        total: 1,
      },
    ],
    rewards: ["สมุด", "กระเป๋า"],
    images: [
      { thumb: notebookThumb, full: notebookFull },
      { thumb: bagThumb, full: bagFull },
    ],
  });
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
    <QrCode value={data.profile.code} class="size-[227px] rounded-md overflow-clip" />
    <div>
      <p class="text-xl">{data.profile.name}</p>
      <p class="text-sm">{data.profile.code}</p>
    </div>
  </Glass>

  <Glass
    as="section"
    options={{ vibrancy: 1.2 }}
    variant="light"
    class="w-full rounded-xl flex flex-col gap-2 p-4 text-center"
  >
    <h2 class="text-xl font-medium text-brand-navy">
      เกียรติบัตรการเข้าร่วมงาน
    </h2>
    {#if progress?.entered}
      {#if data.evaluationSubmitted}
        <p class="text-xs text-brand-navy">
          ส่งแบบประเมินแล้ว <svg
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
          </svg>
        </p>
        <p class="text-xs text-brand-navy">
          เกียรติบัตรจะพร้อมให้ดาวน์โหลดภายหลัง ติดตามประกาศได้ที่ Instagram:
          <a
            href="https://www.instagram.com/scichulaopenhouse"
            target="_blank"
            rel="noreferrer"
            class="font-bold text-brand-blue underline"
          >
            @scichulaopenhouse
          </a>
        </p>
      {:else}
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
        <Button variant="cta" size="cta-sm" href="/evaluation">
          ทำแบบประเมินเพื่อรับเกียรติบัตร
        </Button>
      {/if}
    {:else}
      <p class="text-xs text-brand-mist">
        เช็คอินที่จุดลงทะเบียนในวันงานเท่านั้น จึงจะได้รับเกียรติบัตรนี้
      </p>
    {/if}
  </Glass>

  <section class="flex w-full flex-col gap-3">
    <div class="flex items-end justify-between gap-2 text-brand-navy">
      <div>
        <h2 class="text-2xl font-medium">My Workshops</h2>
        <p class="text-sm font-medium">
          {data.advanceCount > 0
            ? `ลงทะเบียนแล้ว ${data.advanceCount}/${data.workshopLimit} เวิร์กช็อป`
            : "คุณยังไม่ได้ลงทะเบียนเวิร์กช็อปใดเลย"}
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
        <Glass class="rounded-lg flex items-center justify-between gap-3 p-3">
          <p class="text-sm text-brand-mist">
            ลงทะเบียนได้อีก {remaining} เวิร์กช็อป
          </p>
          <Button variant="cta" size="cta-sm" href="/workshop"
            >ลงทะเบียนเพิ่ม</Button
          >
        </Glass>
      {:else if data.workshopRegistrationClosed && data.workshops.length === 0}
        <!-- Nothing booked and booking has closed: walk-ins at the booth are still possible. -->
        <Glass class="rounded-lg flex flex-col gap-1 p-3 text-center">
          <p class="text-base font-medium text-brand-yellow">
            ปิดลงทะเบียนเวิร์กช็อปล่วงหน้าแล้ว
          </p>
          <p class="text-sm text-brand-mist">
            ยังเข้าร่วมแบบ walk-in ได้ที่หน้าบูธเวิร์กช็อป ก่อนเริ่มแต่ละรอบ
            หากรอบนั้นยังมีที่ว่าง
          </p>
          <Button
            variant="cta"
            size="cta-sm"
            href="/workshop"
            class="mt-1 self-center">ดูเวิร์กช็อปทั้งหมด</Button
          >
        </Glass>
      {/if}
    {:else}
      <!-- Placeholder until workshop registration opens. -->
      <Glass class="rounded-lg flex flex-col gap-2 p-3 text-center">
        <p class="text-base font-medium text-brand-yellow">
          เตรียมพบกับการลงทะเบียนเวิร์กช็อป<br />Coming Soon!!
        </p>
        <p class="text-sm text-brand-mist">
          เปิดลงทะเบียน <time
            datetime={EVENT_SCHEDULE.workshopRegistrationOpensAt}
            >{registrationOpensLabel} น.</time
          >
        </p>
      </Glass>
    {/if}
  </section>

  <section class="flex w-full flex-col gap-3">
    <div class="flex items-end justify-between gap-2 text-brand-navy">
      <div>
        <h2 class="text-2xl font-medium">ภารกิจล่าของรางวัล</h2>
        <p class="text-sm font-medium">
          สะสมตราจากบูธและกิจกรรม แล้วแลกของรางวัล
        </p>
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

    <!-- The rules up front: one pick from the unlocked tiers, prizes don't stack, then locked.
         Collapsed by default, with the attendee's redemption status beside the title (whether
         they redeemed, never which tier or gift). The <details> sits inside the glass, which
         would otherwise hide its canvas. -->
    <Glass class="rounded-lg p-3 text-sm text-brand-mist">
      <details class="group">
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-2 text-base font-medium text-brand-yellow [&::-webkit-details-marker]:hidden"
        >
          วิธีแลกของรางวัล
          <span class="flex items-center gap-2">
            {#if progress}
              <span
                class={[
                  "rounded-full px-2.5 py-0.5 text-xs font-medium text-brand-navy",
                  progress.redemption ? "bg-status-green" : "bg-brand-mist",
                ]}
              >
                {progress.redemption
                  ? "✓ แลกรับของรางวัลแล้ว"
                  : "ยังไม่ได้แลกรับของรางวัล"}
              </span>
            {/if}
            <span
              aria-hidden="true"
              class="transition-transform group-open:rotate-180">▾</span
            >
          </span>
        </summary>
        <ol class="mt-2 flex list-decimal flex-col gap-1 ps-5">
          <li>สะสมตราจากบูธ กิจกรรม และเวิร์กช็อป ตามเงื่อนไขของแต่ละขั้นด้านล่าง</li>
          <li>
            <span class="font-medium text-brand-yellow">เลือกแลกได้ 1 อย่าง</span>
            จากขั้นที่ผ่านเงื่อนไขแล้ว ของรางวัลไม่สะสมรวมกัน
            <span class="text-xs"
              >(เช่น ผ่านขั้นกัปตันโจรสลัด จะได้กระบอกน้ำ 1 ใบ ไม่ได้หมอนและหมวกด้วย)</span
            >
          </li>
          <li>
            <span class="font-medium text-brand-yellow">แลกแล้วระบบจะล็อกทันที</span>
            สะสมเพื่อเลื่อนขั้นต่อไม่ได้อีก ถ้าอยากได้ขั้นที่สูงกว่า ให้เก็บให้ครบก่อนแลก
          </li>
          <li>
            ก่อนแลก ลงสตอรี่ IG พร้อมแฮชแท็ก <span
              class="font-medium text-brand-yellow">{rewardHashtags.join(" ")}</span
            > แล้วแสดงให้สตาฟดู
          </li>
        </ol>
      </details>
    </Glass>

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

    <RewardTierCard tier={entryTier} />
    {#each rewardTiers as tier (tier.tier)}
      <RewardTierCard
        tier={{
          title: tier.title,
          conditions: tierConditions(tier, progress?.counts ?? null),
          rewards: tier.rewards,
          images: tierImages[tier.tier],
        }}
      />
    {/each}
  </section>
</main>
