
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
        ลงทะเบียนเสร็จสิ้น
      </h2>

      <p
        class="mt-4 max-w-2xl text-base leading-relaxed
              md:text-lg text-white"
      >
        อย่าลืมมาเจอกัน 
        <br/>
        วันที่ 18-19 ตุลาคม
        <br/>
        @จามจุรีสแคว์
        <br/>
        Be the next Science Hero  
      </p>
      
    </section>

    <section
      class="mx-auto flex w-full max-w-4xl flex-col
            items-center px-4 text-center pt-12
            sm:px-6"
    >
      <a
        href="/register"
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
        <p class="text-xl semibold">กลับไปที่หน้า My ID</p>
      </a>
    </section>
  </div>
</main>
