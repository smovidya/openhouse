
<script lang="ts">
  import { onMount } from "svelte";
  import logo from "#lib/assets/Logo.png";
  import logo_b from "#lib/assets/logo_b.png";
  import qr from "#lib/assets/qr_code.png"
  import arrows from "#lib/assets/arrows.png"

  // Example event date — replace with your actual date.
  const eventDate = new Date("2026-12-01T09:00:00+07:00");

  let currentTime = $state(Date.now());
  let timerReady = $state(false);

  // Remaining time in seconds
  let remaining = $derived(
    Math.max(0, Math.floor((eventDate.getTime() - currentTime) / 1000))
  );

  let days = $derived(Math.floor(remaining / 86400));
  let hours = $derived(Math.floor((remaining % 86400) / 3600));
  let minutes = $derived(Math.floor((remaining % 3600) / 60));
  let seconds = $derived(remaining % 60);

  function twoDigits(value: number) {
    return String(value).padStart(2, "0");
  }

  onMount(() => {
    currentTime = Date.now();
    timerReady = true;

    const interval = setInterval(() => {
      currentTime = Date.now();
    }, 1000);

    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Open House 2026 | Home</title>
  <meta
    name="description"
    content="Welcome to Open House 2026"
  />
</svelte:head>


<main
  class="min-h-screen pt-3 text-white"
  style="
    background:
      radial-gradient(
        ellipse 65% 50% at 50% 45%,
        rgba(75, 105, 156, 0.65) 0%,
        rgba(5, 24, 60, 0.2) 100%,
        transparent 100%
      ),
      #020617;
  "
>


<header
  class="w-full text-white"
  style="
    background: linear-gradient(
      to bottom,
      #FF3C3C 0%,
      #920909 10%,
      #920909 20%,
      #730202 30%,
      #6A0000 40%,
      #6A0000 50%,
      #6A0000 60%,
      #730202 70%,
      #920909 80%,
      #920909 90%,
      #FF3C3C 100%
    );
  "
>

  <div class="px-1 pt-2">
    <div
      class="h-[3px] w-full"
      style="
        background: repeating-linear-gradient(
          to right,
          #F5C0B7 0px,
          #F5C0B7 13px,
          transparent 13px,
          transparent 22px
        );
      "
    ></div>
  </div>

  <nav
    class="flex min-h-40 items-center
           justify-between gap-2
           px-4 py-5
           sm:min-h-48 sm:px-10
           md:min-h-[200px] md:px-14"
  >

    <a href="/" class="shrink-0">
      <img
        src={logo_b}
        alt="Open House Logo"
        class="h-20 w-20 object-contain
               sm:h-28 sm:w-28
               md:h-36 md:w-36"
      />
    </a>

    <div
      class="flex shrink-0 items-center
             gap-2 sm:gap-6 md:gap-10"
    >

      <a
        href="/MyID"
        class="nav-button"
      >
        <img
          src={qr}
          alt="MyID QR"
          class="h-12 w-12 object-contain
                 sm:h-16 sm:w-16
                 md:h-20 md:w-20"
        />

        <span
          class="mt-2 text-center text-base
                 leading-tight sm:text-xl
                 md:text-2xl"
        >
          MyID
        </span>
      </a>

      <a
        href="/navi"
        class="nav-button"
      >
        <img
          src={arrows}
          alt="Navigation arrows"
          class="h-12 w-12 object-contain
                 sm:h-16 sm:w-16
                 md:h-20 md:w-20"
        />

        <span
          class="mt-2 text-center text-base
                 leading-tight sm:text-xl
                 md:text-2xl"
        >
          นำทาง
        </span>
      </a>

    </div>
  </nav>


  <div class="px-1 pb-2">
    <div
      class="h-[3px] w-full"
      style="
        background: repeating-linear-gradient(
          to right,
          #F5C0B7 0px,
          #F5C0B7 13px,
          transparent 13px,
          transparent 22px
        );
      "
    ></div>
  </div>

</header>

<style>
  /* NORMAL: NO BACKGROUND */
  .nav-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    width: 76px;
    height: 105px;
    padding: 8px;

    background: transparent;
    border: 2px solid transparent;
    border-radius: 20px;

    color: white;
    text-decoration: none;

    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  /* EFFECT ONLY WHILE CLICKING */
  .nav-button:active {
    background-color: #490B06;
    border-color: #87352B;

    box-shadow:
      inset 0 3px 8px rgba(0, 0, 0, 0.35);
  }

  /* TABLET */
  @media (min-width: 640px) {
    .nav-button {
      width: 112px;
      height: 128px;
    }
  }

  /* DESKTOP */
  @media (min-width: 768px) {
    .nav-button {
      width: 128px;
      height: 144px;
    }
  }
</style>
 


  <section class=" flex w-full justify-center">
      <img
        src="{logo}"
        alt="Open House Logo"
        class="flex h-100 w-100 items-center justify-cente"
      />
  </section>

  <div class="min-h-screen text-white">
    <section
      class="mx-auto flex w-full max-w-4xl flex-col
            items-center px-4 pb-16 text-center
            sm:px-6"
    >

     
      <h2 class="text-3xl font-bold md:text-4xl">
        Science Chula
        <br/>
        Open House 202
      </h2>

      <div class="text-[#96B8FF]">
        <p
          class="mt-4 max-w-2xl text-base leading-relaxed
                md:text-lg"
        >
          何も無いんだ 何も無いんだ
        </p>
        <p
          class="max-w-2xl text-base leading-relaxed
                md:text-lg"
        >
          何も無いんだ わたしって
        </p>
        <p
          class="max-w-2xl text-base leading-relaxed
                md:text-lg"
        >
          「間違った」その罰がさ
        </p>
        <p
          class="max-w-2xl text-base leading-relaxed
                md:text-lg"
        >
          今もわたしを締め付ける さかなになって
        </p>
      </div>
    </section>

    <div class=" w-full justify-center text-center px-2 py-6"
          style="
              background: linear-gradient(
                to bottom,
                #FF3C3C 0%,
                #920909 10%,
                #920909 20%,
                #730202 30%,
                #6A0000 40%,
                #6A0000 50%,
                #6A0000 60%,
                #730202 70%,
                #920909 80%,
                #920909 90%,
                #FF3C3C 100%
              );
            ">

      <div class="grid grid-cols-4 gap-2 sm:gap-4">
        {#each [
          { label: "Days", value: days },
          { label: "Hours", value: hours },
          { label: "Minutes", value: minutes },
          { label: "Seconds", value: seconds }
        ] as item}
          <div
            class="rounded-xl border border-border
                  bg-card px-2 py-5 shadow-sm sm:p-6"
          >
            <div
              class="text-2xl font-bold tabular-nums
                    text-black sm:text-4xl"
            >
              {timerReady ? twoDigits(item.value) : "--"}
            </div>

            <div
              class="mt-2 text-xs text-muted-foreground
                    sm:text-sm"
            >
              {item.label}
            </div>
          </div>
        {/each}
      </div>

      {#if timerReady && remaining === 0}
        <p class="mt-4 font-medium text-primary">
          The countdown has finished!
        </p>
      {/if}
      </div>

    <section
      class="mx-auto flex w-full max-w-4xl flex-col
            items-center px-4 text-center pt-12
            sm:px-6"
    >
      <a
        href="/MyID"
        class="inline-flex min-h-12 w-full
              max-w-xs items-center flex-col justify-center
              rounded-xl bg-primary px-8 py-3
              text-primary-foreground
              transition hover:opacity-90
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-ring"
        style="
          background: linear-gradient(
            to bottom,
            #FFB843 0%,
            #E99100 25%,
            #DD8900 50%,
            #EC9300 75%,
            #FFB53D 100%
          );
        "
      >
        <p class="text-xl semibold">ลงทะเบียนเลย</p>
        <p class="text-xs">ล็อคอินด้วย google</p>
      </a>

      <section
        class="mt-14 w-full rounded-2xl border border-border
              bg-card p-6 text-left shadow-sm text-black
              md:p-8"
      >
        <h3 class="text-xl font-bold text-black">
          Key dates
        </h3>

        <p class="mt-4">
          เปิดลงทะเบียนเว็บไซต์
        </p>

      </section>
    </section>
  </div>
</main>
