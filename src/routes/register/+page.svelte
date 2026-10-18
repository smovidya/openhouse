
<script lang="ts">
  import logo_b from "#lib/assets/logo_b.png";
  import qr from "#lib/assets/qr_code.png";
  import arrows from "#lib/assets/arrows.png";

  let status = $state("");
  let message = $state("");
  let attemptedSubmit = $state(false);

  let reasons = $state<string[]>([]);
  let channels = $state<string[]>([]);

  let otherReason = $state("");
  let otherChannel = $state("");

  let isStudent = $derived(
    ["junior", "senior", "vocational", "university"]
      .includes(status)
  );

  let isGeneral = $derived(
    ["general", "parent"].includes(status)
  );

  let missingReasons = $derived(
    isGeneral && reasons.length === 0
  );

  let missingChannels = $derived(
    status !== "" && channels.length === 0
  );

  const interests = [
    "วิศวกรรมศาสตร์",
    "วิทยาศาสตร์",
    "เทคโนโลยีสารสนเทศ",
    "บริหารธุรกิจ",
    "ศิลปศาสตร์",
    "อื่น ๆ"
  ];

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    attemptedSubmit = true;
    message = "";

    if (status === "") {
      return;
    }

    if (missingReasons || missingChannels) {
      return;
    }

    message =
      "กรอกข้อมูลครบถ้วนแล้ว แต่ยังไม่ได้เชื่อมต่อระบบลงทะเบียน";
  }
</script>



<div
  class="page min-h-screen"
  class:general-theme={isGeneral}
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

  <main class="mx-auto w-full max-w-xl px-5 py-6 sm:px-8">

    <h1 class="mb-6 text-2xl font-bold">
      ลงทะเบียนเข้าร่วมงาน
    </h1>

    <form
      onsubmit={handleSubmit}
      class="registration-form space-y-5"
      class:show-errors={attemptedSubmit}
    >

      <h2 class="text-lg font-medium">
        ข้อมูลส่วนตัว
      </h2>

      <div class="grid grid-cols-2 gap-3">

        <div class="field">

          <label for="firstName">
            ชื่อ (และคำนำหน้า)
          </label>

          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            class="form-input"
          />

        </div>

        <div class="field">

          <label for="lastName">
            นามสกุล
          </label>

          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            class="form-input"
          />

        </div>

      </div>

      <p class="certificate-note text-xs">
        * ตรวจสอบให้ถูกต้องก่อนการรับเกียรติบัตรการเข้าร่วม
      </p>

      <div class="field">

        <label for="age">
          อายุ (ปี)
        </label>

        <input
          id="age"
          name="age"
          type="number"
          min="1"
          max="120"
          required
          class="form-input"
        />

      </div>

      <div class="field">

        <label for="specialNeeds">
          ความต้องการพิเศษ (ถ้ามี)
        </label>

        <input
          id="specialNeeds"
          name="specialNeeds"
          type="text"
          placeholder="เช่น พิการทางการได้ยิน หรือ Wheelchair"
          class="form-input"
        />

      </div>

      <div class="field">

        <label for="province">
          จังหวัดที่อาศัยในปัจจุบัน
        </label>

        <input
          id="province"
          name="province"
          type="text"
          placeholder="กรุงเทพมหานคร"
          required
          class="form-input"
        />

      </div>

      <div class="field">

        <label for="status">
          สถานะ
        </label>

        <select
          id="status"
          name="status"
          bind:value={status}
          required
          class="form-input"
        >

          <option value="" disabled>
            เลือกสถานะ
          </option>

          <option value="junior">
            มัธยมศึกษาตอนต้น
          </option>

          <option value="senior">
            มัธยมศึกษาตอนปลาย
          </option>

          <option value="vocational">
            ปวช. / ปวส.
          </option>

          <option value="university">
            นักศึกษามหาวิทยาลัย
          </option>

          <option value="general">
            บุคคลทั่วไป
          </option>

          <option value="parent">
            ผู้ปกครอง
          </option>

        </select>

      </div>

      {#if status !== ""}

        {#if isStudent}

          <div class="field">

            <label for="school">
              สถานศึกษา
            </label>

            <input
              id="school"
              name="school"
              type="text"
              placeholder="โรงเรียนหรือสถานศึกษา"
              required
              class="form-input"
            />

          </div>

          <section class="space-y-2">

            <h2 class="text-sm font-medium">
              สาขาวิชาที่สนใจ
            </h2>

            {#each [1, 2, 3] as number}

              <div class="flex items-stretch gap-2">

                <div class="number-box">
                  {number}
                </div>

                <select
                  name={"interest" + number}
                  aria-label={"สาขาวิชาที่สนใจอันดับ " + number}
                  required={number === 1}
                  class="form-input min-w-0 flex-1"
                >

                  <option value="">
                    {number === 3
                      ? "(ไม่เลือกเพิ่มเติม)"
                      : "เลือกสาขาวิชา"}
                  </option>

                  {#each interests as interest}
                    <option value={interest}>
                      {interest}
                    </option>
                  {/each}

                </select>

              </div>

            {/each}

          </section>

        {:else if isGeneral}

          <section class="space-y-3">

            <h2 class="text-sm font-medium">
              เหตุผลในการเข้าร่วม
              (เลือกได้หลายคำตอบ)
            </h2>

            <div
              class="choice-group"
              class:invalid-group={attemptedSubmit && missingReasons}
            >

              <div class="grid grid-cols-2 gap-4">

                <label class="check-label">

                  <input
                    type="checkbox"
                    name="reasons"
                    value="accompany"
                    bind:group={reasons}
                  />

                  <span>
                    มากับนักเรียน/นักศึกษา
                  </span>

                </label>

                <label class="check-label">

                  <input
                    type="checkbox"
                    name="reasons"
                    value="curriculum"
                    bind:group={reasons}
                  />

                  <span>
                    ศึกษาข้อมูลหลักสูตร
                  </span>

                </label>

                <label class="check-label">

                  <input
                    type="checkbox"
                    name="reasons"
                    value="atmosphere"
                    bind:group={reasons}
                  />

                  <span>
                    ดูสถานที่และบรรยากาศ
                    ภายในมหาวิทยาลัย
                  </span>

                </label>

                <label class="check-label">

                  <input
                    type="checkbox"
                    name="reasons"
                    value="study"
                    bind:group={reasons}
                  />

                  <span>
                    สนใจศึกษาต่อ
                  </span>

                </label>

                <label class="check-label col-span-2">

                  <input
                    type="checkbox"
                    name="reasons"
                    value="other"
                    bind:group={reasons}
                  />

                  <span>
                    อื่น ๆ (โปรดระบุ)
                  </span>

                </label>

              </div>

            </div>

            {#if attemptedSubmit && missingReasons}
              <p class="error-text">
                กรุณาเลือกเหตุผลในการเข้าร่วมอย่างน้อย 1 ข้อ
              </p>
            {/if}

            <input
              type="text"
              name="otherReason"
              aria-label="ระบุเหตุผลอื่น ๆ"
              placeholder="ระบุเหตุผลอื่น ๆ"
              bind:value={otherReason}
              required={reasons.includes("other")}
              class="form-input"
            />

          </section>

        {/if}

        <section class="space-y-4 pt-2">

          <h2 class="text-sm font-medium leading-relaxed">
            ท่านทราบและติดตามข่าวสาร
            <br />
            เกี่ยวกับงานผ่านช่องทางใดบ้าง
            (เลือกหลายคำตอบ)
          </h2>

          <div
            class="choice-group"
            class:invalid-group={attemptedSubmit && missingChannels}
          >

            <div class="grid grid-cols-2 gap-x-4 gap-y-4">

              <label class="check-label">

                <input
                  type="checkbox"
                  name="channels"
                  value="friends"
                  bind:group={channels}
                />

                <span>
                  เพื่อน/ผู้ปกครอง/คนรู้จัก
                </span>

              </label>

              <label class="check-label">

                <input
                  type="checkbox"
                  name="channels"
                  value="social"
                  bind:group={channels}
                />

                <span>
                  สื่อสังคมออนไลน์
                  (ที่ไม่ใช่ของงาน)
                </span>

              </label>

              <label class="check-label col-span-2">

                <input
                  type="checkbox"
                  name="channels"
                  value="officialSocial"
                  bind:group={channels}
                />

                <span>
                  สื่อสังคมออนไลน์ของงาน
                  (IG: smovidya)
                </span>

              </label>

              <label class="check-label">

                <input
                  type="checkbox"
                  name="channels"
                  value="dekd"
                  bind:group={channels}
                />

                <span>Dek-D</span>

              </label>

              <label class="check-label">

                <input
                  type="checkbox"
                  name="channels"
                  value="camphub"
                  bind:group={channels}
                />

                <span>CampHub</span>

              </label>

              <label class="check-label col-span-2">

                <input
                  type="checkbox"
                  name="channels"
                  value="advertisement"
                  bind:group={channels}
                />

                <span>
                  ป้ายโฆษณา (ที่ต่าง ๆ)
                </span>

              </label>

              <label class="check-label col-span-2">

                <input
                  type="checkbox"
                  name="channels"
                  value="other"
                  bind:group={channels}
                />

                <span>
                  อื่น ๆ (โปรดระบุ)
                </span>

              </label>

            </div>

          </div>

          {#if attemptedSubmit && missingChannels}
            <p class="error-text">
              กรุณาเลือกช่องทางที่ทราบข่าวสารอย่างน้อย 1 ข้อ
            </p>
          {/if}

          <input
            type="text"
            name="otherChannel"
            aria-label="ระบุช่องทางอื่น"
            placeholder="ระบุช่องทางอื่น"
            bind:value={otherChannel}
            required={channels.includes("other")}
            class="form-input"
          />

        </section>

        <section class="space-y-4 pt-2">

          <h2 class="text-sm font-medium">
            นโยบายข้อมูลส่วนบุคคล
          </h2>

          <div class="policy-box">

            <p>
              พื้นที่สำหรับแสดงรายละเอียด
              นโยบายข้อมูลส่วนบุคคล
              สำหรับการลงทะเบียนเข้าร่วมงาน
              Open House 2026
            </p>

            <p class="mt-4">
              ผู้จัดงานจะต้องระบุวัตถุประสงค์
              ของการเก็บรวบรวมข้อมูล
              การนำข้อมูลไปใช้
              ระยะเวลาการเก็บรักษา
              และสิทธิของเจ้าของข้อมูล
            </p>

            <p class="mt-4">
              กรุณาแทนที่ข้อความนี้ด้วย
              นโยบายข้อมูลส่วนบุคคลจริง
              ก่อนเปิดใช้งานระบบ
            </p>

          </div>

          <label class="check-label">

            <input
              type="checkbox"
              name="acceptPolicy"
              required
            />

            <span>
              ยอมรับนโยบายข้อมูลส่วนบุคคล
              และข้อกำหนดการใช้งานระบบ
            </span>

          </label>

        </section>

      {/if}

      <button
        type="submit"
        onclick={() => {
          attemptedSubmit = true;
          message = "";
        }}
        class="register-button"
        class:general-button={isGeneral}
      >

        {#if isGeneral}

          <span class="text-base font-semibold">
            บันทึกและลงทะเบียน
          </span>

        {:else}

          <span class="text-xl font-semibold">
            ลงทะเบียนเลย
          </span>

          <span class="text-xs opacity-80">
            เชื่อมต่อด้วย Google
          </span>

        {/if}

      </button>

      {#if message}

        <p
          class="text-center text-sm"
          role="status"
        >
          {message}
        </p>

      {/if}

    </form>

  </main>
</div>

<style>
  /* ================================== */
  /* PAGE: BLUE GRADIENT */
  /* ================================== */

  .page {
    --page-text: #ffffff;
    --note-color: #fbbf24;

    min-height: 100vh;
    color: var(--page-text);

    background: linear-gradient(
      to bottom,
      #081831 0%,
      #11284e 20%,
      #405b87 48%,
      #283f69 73%,
      #071630 100%
    );
  }

  /* GENERAL VISITOR: GRAY VERSION */
  .page.general-theme {
    --page-text: #111111;
    --note-color: #222222;

    background: #dedede;
  }

  /* ================================== */
  /* FIELD AND LABEL */
  /* ================================== */

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .field label {
    color: var(--page-text);
    font-size: 0.875rem;
    font-weight: 500;
  }

  /* ================================== */
  /* WHITE INPUT BOXES */
  /* ================================== */

  .form-input {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 38px;

    box-sizing: border-box;
    padding: 8px 10px;

    background-color: #ffffff !important;
    color: #4b5563 !important;

    border: 1px solid #d1d5db;
    border-radius: 3px;

    font-size: 0.875rem;
  }

  .form-input::placeholder {
    color: #9ca3af !important;
    opacity: 1;
  }

  .form-input:focus {
    outline: 2px solid #fbbf24;
    outline-offset: 1px;
  }

  /* ================================== */
  /* NEW: RED INVALID INPUTS */
  /* ================================== */

  :global(form.show-errors .form-input:invalid) {
    border: 2px solid #ef4444 !important;
    background-color: #ffffff !important;
  }

  :global(form.show-errors .form-input:invalid:focus) {
    outline: 2px solid #ef4444;
    outline-offset: 1px;
  }

  /* NEW: INVALID FIELD LABEL */
  :global(form.show-errors .field:has(.form-input:invalid) label) {
    color: #fca5a5;
  }

  /* NEW: INVALID PRIVACY CHECKBOX */
  :global(form.show-errors input[name="acceptPolicy"]:invalid) {
    outline: 2px solid #ef4444;
    outline-offset: 3px;
  }

  /* ================================== */
  /* NEW: RED CHECKBOX GROUP */
  /* ================================== */

  .choice-group {
    padding: 8px;
    border: 2px solid transparent;
    border-radius: 8px;
  }

  .choice-group.invalid-group {
    border-color: #ef4444;
  }

  /* NEW: ERROR TEXT */
  .error-text {
    color: #fca5a5;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.5;
  }

  /* DARK RED TEXT ON LIGHT THEME */
  .general-theme .error-text {
    color: #b91c1c;
  }

  /* ================================== */
  /* CERTIFICATE NOTE */
  /* ================================== */

  .certificate-note {
    color: var(--note-color);
  }

  /* ================================== */
  /* NUMBER BOXES */
  /* ================================== */

  .number-box {
    display: flex;
    align-items: center;
    justify-content: center;

    flex-shrink: 0;
    width: 38px;

    background-color: #ffffff;
    color: #111827;

    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 3px;
  }

  /* ================================== */
  /* CHECKBOX */
  /* ================================== */

  .check-label {
    display: flex;
    align-items: flex-start;
    gap: 8px;

    color: var(--page-text);
    font-size: 0.875rem;
    line-height: 1.4;

    cursor: pointer;
  }

  .check-label input {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    margin-top: 2px;

    accent-color: #fbbf24;
  }

  /* ================================== */
  /* PRIVACY POLICY BOX */
  /* ================================== */

  .policy-box {
    width: 100%;
    height: 200px;
    overflow-y: auto;

    box-sizing: border-box;
    padding: 14px;

    background-color: #ffffff;
    color: #111827;

    border-radius: 14px;
    border: 1px solid #d1d5db;

    font-size: 0.8rem;
    line-height: 1.5;
  }

  /* ================================== */
  /* GOLD REGISTRATION BUTTON */
  /* ================================== */

  .register-button {
    display: flex;
    width: 100%;
    min-height: 52px;

    flex-direction: column;
    align-items: center;
    justify-content: center;

    padding: 8px 16px;
    margin-top: 30px;

    border: none;
    border-radius: 9px;
    color: #ffffff;

    background: linear-gradient(
      to bottom,
      #FFB843 0%,
      #E99100 25%,
      #DD8900 50%,
      #EC9300 75%,
      #FFB53D 100%
    );

    cursor: pointer;
  }

  .register-button:hover {
    filter: brightness(1.08);
  }

  /* GENERAL VISITOR: BLACK BUTTON */
  .register-button.general-button {
    background: #222222;
    border-radius: 0;
  }

  /* BANNER NAVIGATION BUTTONS */

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
