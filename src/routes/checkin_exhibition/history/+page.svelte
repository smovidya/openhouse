<script lang="ts">
  import { goto } from '$app/navigation';
  let menuOpen = $state(false);

  const checkins = [
    { id: 1, name: 'นายพัสกร ยืนยง', age: 17, level: 'มัธยมศึกษาตอนปลาย', booth: 'Mathematics and computer science 1', round: '10:00 - 11:00', time: '15:35 น.' },
    { id: 2, name: 'นายพัสกร ยืนยง', age: 17, level: 'มัธยมศึกษาตอนปลาย', booth: 'Mathematics and computer science 1', round: '10:00 - 11:00', time: '15:35 น.' },
    { id: 3, name: 'นายพัสกร ยืนยง', age: 17, level: 'มัธยมศึกษาตอนปลาย', booth: 'Mathematics and computer science 1', round: '10:00 - 11:00', time: '15:35 น.' },
    { id: 4, name: 'นายพัสกร ยืนยง', age: 17, level: 'มัธยมศึกษาตอนปลาย', booth: 'Mathematics and computer science 1', round: '10:00 - 11:00', time: '15:35 น.' },
    { id: 5, name: 'นายพัสกร ยืนยง', age: 17, level: 'มัธยมศึกษาตอนปลาย', booth: 'Mathematics and computer science 1', round: '10:00 - 11:00', time: '15:35 น.' },
    { id: 6, name: 'นายพัสกร ยืนยง', age: 17, level: 'มัธยมศึกษาตอนปลาย', booth: 'Mathematics and computer science 1', round: '10:00 - 11:00', time: '15:35 น.' }
  ];
</script>

<svelte:head><title>ประวัติการเช็คอิน | Open House</title></svelte:head>

<div class="min-h-screen bg-[#243e65] text-white">

  <main class="mx-auto max-w-[520px] px-3 pb-28 pt-8">
    <h1 class="mb-8 text-center text-[29px] font-medium text-[#ffd45a]">บูธนิทรรศการ</h1>
    <h2 class="mb-4 text-[21px] text-[#a3bdd8]">ประวัติการเช็คอิน</h2>
    <div class="space-y-4">
      {#each checkins as checkin (checkin.id)}
        <article class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[15px] leading-[1.55] text-[#d4e0ed]">
          <div>
            <p>{checkin.name}</p>
            <p>{checkin.age} ปี / {checkin.level}</p>
            <p>{checkin.booth}</p>
            <p>รอบ {checkin.round}</p>
          </div>
          <div class="self-center whitespace-nowrap text-right text-[14px]">เวลา {checkin.time}</div>
        </article>
      {/each}
    </div>
  </main>
  <div class="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] bg-gradient-to-t from-[#243e65] from-65% to-transparent px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-7">
    <button type="button" onclick={() => goto('/checkin')} class="h-[57px] w-full rounded-full bg-[#ffd45a] text-xl font-medium text-[#86502b] hover:bg-[#ffe083]">ย้อนกลับ</button>
  </div>
</div>
