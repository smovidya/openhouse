import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

// Shared steps for the e2e specs. They run against the local D1 through the dev toolbar:
// "Use attendee" is an already registered fixture; "New registration" signs in a fresh account.

/** Load a page and give SvelteKit time to hydrate (clicks before that do nothing). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Open the dev toolbar on the current page and run `action` in its panel, then close it. */
async function inDevToolbar(
  page: Page,
  action: (panel: ReturnType<Page["locator"]>) => Promise<void>,
) {
  const toggle = page.getByRole("button", { name: /DEV/ });
  await toggle.click();
  const panel = page.locator("#dev-toolbar-panel");
  await action(panel);
  if (await panel.isVisible()) await toggle.click();
}

/** Use one of the dev toolbar's session buttons. */
export async function devSession(
  page: Page,
  button: "Use attendee" | "New registration",
) {
  await open(page, "/");
  await inDevToolbar(page, async (panel) => {
    await panel.getByRole("button", { name: button }).click();
    if (button === "New registration") {
      // The toolbar goes straight to the registration form.
      await expect(page).toHaveURL(/\/register$/);
    } else {
      await expect(panel.getByRole("status")).toHaveText(/^Signed in as /);
    }
  });
}

/** Freeze the server's clock for this browser at one of the dev toolbar's schedule presets. */
export async function freezeClock(
  page: Page,
  preset: "Workshops open" | "Workshops close",
) {
  await open(page, "/");
  await inDevToolbar(page, async (panel) => {
    await panel.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
    await expect(panel.getByRole("status")).toHaveText(preset);
  });
}

/** Freeze the server's clock for this browser at a Bangkok local time, e.g. "2026-10-20T17:00". */
export async function freezeClockAt(page: Page, bangkokTime: string) {
  await open(page, "/");
  await inDevToolbar(page, async (panel) => {
    await panel.getByLabel("Bangkok time (UTC+07:00)").fill(bangkokTime);
    await panel.getByRole("button", { name: "Freeze time" }).click();
    await expect(panel.getByRole("status")).toHaveText("Clock frozen");
  });
}

/** Choose an option in one of the form's pickers, found by its placeholder. */
async function pick(page: Page, placeholder: string, option: string) {
  const picker = page.locator("[data-slot=picker]", {
    has: page.locator("[data-slot=picker-trigger]", { hasText: placeholder }),
  });
  await picker.locator("[data-slot=picker-trigger]").click();
  await picker
    .locator("[data-slot=picker-item]", { hasText: option })
    .first()
    .click();
}

/** Fill the registration form (on /register), accept PDPA and submit; lands on /myid. */
export async function completeRegistration(
  page: Page,
  { firstName, lastName }: { firstName: string; lastName: string },
) {
  // The prefix picker shows no placeholder; it is the first picker on the form.
  await page.locator("[data-slot=picker-trigger]").first().click();
  await page
    .locator("[data-slot=picker-item]", { hasText: "นางสาว" })
    .first()
    .click();
  await page.fill("input[name=firstName]", firstName);
  await page.fill("input[name=lastName]", lastName);
  await page.fill("input[name=age]", "15");
  await page.locator("[data-slot=select-trigger]").click();
  await page.getByRole("option", { name: "เชียงใหม่" }).click();
  await page.fill("input[name=emergencyPhone]", "0812345678");
  await page.fill("input[name=emergencyName]", "ฮิโระ นิไคโด");
  await page.fill("input[name=reason]", "อยากรู้จักคณะ");
  await page.fill("input[name=expectation]", "ได้ลองทำเวิร์คช็อป");
  await pick(page, "เลือกคำตอบ", "ตั้งใจมางานนี้");
  await pick(page, "เลือกสถานะ", "มัธยมศึกษาตอนปลาย");
  await page.fill("input[name=schoolName]", "โรงเรียนทดสอบ");
  // Three major pickers share a placeholder; pick the first by its label.
  const major1 = page.getByRole("button", {
    name: "สาขาวิชาที่สนใจ อันดับที่ 1",
  });
  await major1.click();
  await page
    .locator("[data-slot=picker]", { has: major1 })
    .locator("[data-slot=picker-item]", { hasText: "ฟิสิกส์" })
    .click();

  await page.getByRole("button", { name: "ถัดไป" }).click();
  await expect(page).toHaveURL(/step=pdpa/);
  await page.getByText("ยอมรับนโยบายข้อมูลส่วนบุคคล").click();
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await expect(page).toHaveURL(/\/myid$/);
}

// Wrangler's own script under Node, without a shell, so the SQL reaches it as one argument.
const wrangler = join(
  process.cwd(),
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

/** Run SQL (or a package script) against the local D1. */
export function localD1(sql: string) {
  execFileSync(
    process.execPath,
    [wrangler, "d1", "execute", "DB", "--local", "--command", sql],
    {
      stdio: "pipe",
    },
  );
}

/** Run one SELECT against the local D1 and return its rows. */
export function localD1Rows<Row>(sql: string): Row[] {
  const output = execFileSync(
    process.execPath,
    [wrangler, "d1", "execute", "DB", "--local", "--json", "--command", sql],
    { stdio: "pipe", encoding: "utf8" },
  );
  return (JSON.parse(output) as { results: Row[] }[])[0].results;
}

/** Make sure the department booths and event checkpoints exist in the local D1 (repeat-safe). */
export function seedBooths() {
  execFileSync("bun", ["run", "booths:seed"], {
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

/** Make sure the workshops exist in the local D1 (the seed is repeat-safe). */
export function seedWorkshops() {
  execFileSync("bun", ["run", "workshops:seed"], {
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

export type TestAttendee = {
  id: string;
  qr: string;
  firstname: string;
  lastname: string;
};

export const fullName = (attendee: TestAttendee) =>
  `${attendee.firstname} ${attendee.lastname}`;

/** Registered attendees (with their accounts), aged 16, email `<id>@example.com`. */
export function insertAttendees(attendees: TestAttendee[]) {
  localD1(
    attendees
      .map(
        (attendee) => `
      INSERT INTO users (id, google_id, email, name, role)
      VALUES ('${attendee.id}', '${attendee.id}', '${attendee.id}@example.com', 'E2E attendee', 'attendee');
      INSERT INTO attendees (id, qrCodeId, user_id, title, firstname, lastname, age, resident_province, type)
      VALUES ('${attendee.id}', '${attendee.qr}', '${attendee.id}', 'นาย', '${attendee.firstname}', '${attendee.lastname}', 16, 'กรุงเทพมหานคร', 'student');`,
      )
      .join("\n"),
  );
}

/** Deletes the attendees with everything recorded about them. */
export function deleteAttendees(ids: string[]) {
  const list = ids.map((id) => `'${id}'`).join(", ");
  localD1(`
    DELETE FROM reward_redemptions WHERE attendee_id IN (${list});
    DELETE FROM checkpoint_logs WHERE attendee_id IN (${list});
    DELETE FROM workshop_registrations WHERE attendee_id IN (${list});
    DELETE FROM attendees WHERE id IN (${list});
    DELETE FROM users WHERE id IN (${list});
  `);
}

/** Checkpoints an attendee has been scanned at (seedBooths / seedWorkshops first). */
export type Stamps = {
  /** An entry checkpoint's id. */
  entry?: string;
  tcas?: boolean;
  central?: boolean;
  stage?: boolean;
  /** How many department booths (the first ones by id). */
  booths?: number;
  /** Workshop rounds attended, by time slot id (e.g. workshop-geo-map-1). */
  workshopSlots?: string[];
};

/** Records the attendee's scans directly in D1; log ids are `<attendee id>-<checkpoint id>`. */
export function stamp(attendeeId: string, stamps: Stamps) {
  const types = [
    stamps.tcas && "'tcas'",
    stamps.central && "'central_activity'",
    stamps.stage && "'stage'",
  ].filter(Boolean);
  const matches = [
    stamps.entry && `id = '${stamps.entry}'`,
    types.length > 0 && `type IN (${types.join(", ")})`,
    stamps.booths &&
      `id IN (SELECT id FROM checkpoints WHERE type = 'booth' AND deleted_at IS NULL ORDER BY id LIMIT ${stamps.booths})`,
  ].filter(Boolean);
  const statements = [
    matches.length > 0 &&
      `INSERT INTO checkpoint_logs (id, attendee_id, checkpoint_id)
       SELECT '${attendeeId}-' || id, '${attendeeId}', id FROM checkpoints
       WHERE deleted_at IS NULL AND (${matches.join(" OR ")});`,
    ...(stamps.workshopSlots ?? []).map(
      (slot) =>
        `INSERT INTO checkpoint_logs (id, attendee_id, checkpoint_id, workshop_id, attendance_type)
         SELECT '${attendeeId}-' || c.id, '${attendeeId}', c.id, s.workshop_id, 'walk-in'
         FROM checkpoints c JOIN workshop_time_slots s ON s.id = c.workshop_time_slot_id
         WHERE s.id = '${slot}' AND c.type = 'workshop' AND c.deleted_at IS NULL;`,
    ),
  ].filter(Boolean);
  if (statements.length > 0) localD1(statements.join("\n"));
}

/** The signed-in dev session's user id. */
export async function sessionUserId(page: Page) {
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "vidyachula-session-dev",
  );
  expect(cookie).toBeDefined();
  return (
    JSON.parse(
      Buffer.from(cookie!.value.split(".")[1], "base64url").toString(),
    ) as { sub: string }
  ).sub;
}

/**
 * Sign in as a fresh local account and make it staff with `permissions` (directly in D1, skipping
 * the invite code). Returns the user id; delete it with `deleteStaff`.
 */
export async function signInAsStaff(page: Page, permissions: string[]) {
  await devSession(page, "New registration");
  const sub = await sessionUserId(page);
  localD1(`
    INSERT INTO staffs (id, user_id, type, name, phone, permission)
    VALUES ('${sub}', '${sub}', 'test', 'E2E staff', '0000000000', '${JSON.stringify(permissions)}');
    UPDATE users SET role = 'staff' WHERE id = '${sub}';
  `);
  return sub;
}

/** Deletes the account and the check-ins and redemptions it recorded (they reference it). */
export function deleteStaff(userId: string) {
  localD1(`
    DELETE FROM reward_redemptions WHERE checker_id = '${userId}';
    DELETE FROM checkpoint_logs WHERE checker_id = '${userId}' OR removed_by_id = '${userId}';
    DELETE FROM staffs WHERE user_id = '${userId}';
    DELETE FROM users WHERE id = '${userId}';
  `);
}
