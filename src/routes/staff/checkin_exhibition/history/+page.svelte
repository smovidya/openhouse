
<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";

  type Checkin = {
    id: string;
    name: string;
    age: number;
    level: string;
    booth: string;
    round: string;
    time: string;
  };

  let { data }: { data: { checkins: Checkin[] } } = $props();

  let checkins = $derived(data.checkins);
</script>

<svelte:head>
  <title>ประวัติการเช็คอิน | Open House</title>
</svelte:head>

<div class="min-h-screen bg-brand-navy text-white">
  <main class="mx-auto max-w-[520px] px-3 pb-28 pt-8">

    <h1
      class="mb-8 text-center text-[29px]
             font-medium text-brand-yellow"
    >
      บูธนิทรรศการ
    </h1>

    <h2 class="mb-4 text-[21px] text-brand-mist">
      ประวัติการเช็คอิน
    </h2>

    <div class="space-y-4">
      {#each checkins as checkin (checkin.id)}
        <article
          class="grid grid-cols-[minmax(0,1fr)_auto]
                 gap-2 text-[15px] leading-[1.55]
                 text-brand-mist"
        >
          <div>
            <p>{checkin.name}</p>

            <p>
              {checkin.age} ปี / {checkin.level}
            </p>

            <p>{checkin.booth}</p>

            <p>รอบ {checkin.round}</p>
          </div>

          <div
            class="self-center whitespace-nowrap
                   text-right text-[14px]"
          >
            เวลา {checkin.time}
          </div>
        </article>
      {:else}
        <p class="py-8 text-center text-brand-mist">
          ยังไม่มีประวัติการเช็คอิน
        </p>
      {/each}
    </div>

  </main>

  <div
    class="fixed inset-x-0 bottom-0 z-20
           mx-auto max-w-[520px]
           bg-gradient-to-t
           from-brand-navy from-65%
           to-transparent
           px-3
           pb-[max(20px,env(safe-area-inset-bottom))]
           pt-7"
  >
    <Button
      variant="cta"
      size="cta-lg"
      href="/checkin_exhibition"
      class="w-full"
    >
      ย้อนกลับ
    </Button>
  </div>
</div>
