import { expect, test, type Page } from "@playwright/test";
import {
  deleteStaff,
  localD1,
  open,
  seedWorkshops,
  signInAsStaff,
} from "./helpers";

// Staff scanner pages against the local D1, through the code form (the camera isn't available
// headless).

test.describe.configure({ mode: "serial" });

type TestAttendee = {
  id: string;
  qr: string;
  firstname: string;
  lastname: string;
};
const name = (attendee: TestAttendee) =>
  `${attendee.firstname} ${attendee.lastname}`;

// Real-format codes. `entrant` only checks in at the entry point; `walker` comes to a workshop
// round without booking it; `booker` booked it.
const entrant: TestAttendee = {
  id: "e2e-scan-entrant",
  qr: "E2E7Q",
  firstname: "สแกน",
  lastname: "ทดสอบ",
};
const walker: TestAttendee = {
  id: "e2e-scan-walker",
  qr: "E2E9W",
  firstname: "เดิน",
  lastname: "เข้ามา",
};
const booker: TestAttendee = {
  id: "e2e-scan-booker",
  qr: "E2E3K",
  firstname: "จอง",
  lastname: "ล่วงหน้า",
};
const attendees = [entrant, walker, booker];
const entryCheckpoint = "e2e-scan-entry";
// geo-map round 1, as scripts/seed-workshops.ts writes it.
const session = "geo-map:1";
const slot = "workshop-geo-map-1";

const enter = (attendee: TestAttendee) =>
  `INSERT INTO checkpoint_logs (id, attendee_id, checkpoint_id) VALUES ('${attendee.id}-entry', '${attendee.id}', '${entryCheckpoint}');`;

function cleanUp() {
  const ids = attendees.map((attendee) => `'${attendee.id}'`).join(", ");
  localD1(`
    DELETE FROM checkpoint_logs WHERE attendee_id IN (${ids});
    DELETE FROM workshop_registrations WHERE attendee_id IN (${ids});
    DELETE FROM attendees WHERE id IN (${ids});
    DELETE FROM users WHERE id IN (${ids});
    DELETE FROM checkpoints WHERE id = '${entryCheckpoint}';
  `);
}

let staffId: string | null = null;

test.beforeAll(() => {
  seedWorkshops();
  cleanUp();
  const rows = attendees.map(
    (attendee) => `
      INSERT INTO users (id, google_id, email, name, role)
      VALUES ('${attendee.id}', '${attendee.id}', '${attendee.id}@example.com', 'Scan Test', 'attendee');
      INSERT INTO attendees (id, qrCodeId, user_id, title, firstname, lastname, age, resident_province, type)
      VALUES ('${attendee.id}', '${attendee.qr}', '${attendee.id}', 'นาย', '${attendee.firstname}', '${attendee.lastname}', 16, 'กรุงเทพมหานคร', 'student');`,
  );
  localD1(`
    ${rows.join("\n")}
    INSERT INTO checkpoints (id, name, type) VALUES ('${entryCheckpoint}', 'E2E entry', 'entry');
    ${enter(booker)}
    INSERT INTO workshop_registrations (id, workshop_time_slot_id, attendee_id, type)
    VALUES ('${booker.id}-booking', '${slot}', '${booker.id}', 'advance');
  `);
});

test.afterEach(() => {
  if (staffId) deleteStaff(staffId);
  staffId = null;
});

test.afterAll(cleanUp);

const codeField = (page: Page) => page.getByLabel("กรอกรหัสของผู้ร่วมงาน");
const submitCode = (page: Page) =>
  page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();

/** Type `code` into the code form and submit it. */
async function enterCode(page: Page, code: string) {
  if (!(await codeField(page).isVisible()))
    await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await codeField(page).fill(code);
  await submitCode(page);
}

const sheet = (page: Page) => page.getByRole("dialog");

/** Confirm the sheet, checking it shows `attendee`. */
async function confirmSheet(page: Page, attendee: TestAttendee, title: string) {
  await expect(sheet(page).getByRole("heading", { name: title })).toBeVisible();
  await expect(sheet(page).getByText(name(attendee))).toBeVisible();
  await sheet(page).getByRole("button", { name: "ตกลง" }).click();
}

async function dismissError(page: Page, title: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "ตกลง" }).click();
  await expect(dialog).toBeHidden();
}

test("entry check-in looks up a typed code and checks the attendee in once", async ({
  page,
}) => {
  staffId = await signInAsStaff(page, ["activityStaff"]);
  await open(page, "/staff/check-in");

  // Unknown codes fail the lookup with a dialog, not text.
  await enterCode(page, "zzzzz");
  await dismissError(page, "ไม่พบผู้เข้าร่วมงาน");

  // Typed in lower case: real codes are upper case.
  await enterCode(page, entrant.qr.toLowerCase());
  await expect(sheet(page).getByText("16 ปี")).toBeVisible();
  await confirmSheet(page, entrant, "เช็คอินผู้เข้าร่วมงาน");
  await expect(page.getByRole("status")).toContainText(
    `เช็คอิน ${name(entrant)} แล้ว`,
  );

  // A repeat scan says so instead of failing.
  await enterCode(page, entrant.qr);
  await confirmSheet(page, entrant, "เช็คอินผู้เข้าร่วมงาน");
  await expect(page.getByRole("status")).toContainText(
    `${name(entrant)} เช็คอินไปแล้วก่อนหน้านี้`,
  );
});

test("workshop check-in: entry first, booked-only check-in, walk-ins, and the participant list", async ({
  page,
}) => {
  staffId = await signInAsStaff(page, ["workshopStaff"]);
  await open(
    page,
    `/staff/workshop-check-in?session=${encodeURIComponent(session)}`,
  );
  await expect(
    page.getByRole("heading", { name: "เช็คอิน บูธเวิร์คช็อป" }),
  ).toBeVisible();

  // Not through the entry point yet.
  await enterCode(page, walker.qr);
  await confirmSheet(page, walker, "เช็คอินผู้เข้าร่วมงาน");
  await dismissError(page, "ยังไม่ได้ผ่านจุดลงทะเบียน");

  // Entered, but เช็คอิน only lets in attendees who booked this round.
  localD1(enter(walker));
  await submitCode(page);
  await confirmSheet(page, walker, "เช็คอินผู้เข้าร่วมงาน");
  await dismissError(page, "ไม่ได้ลงทะเบียนล่วงหน้า");

  // เพิ่มคน adds them as a walk-in.
  await page.getByRole("button", { name: "เพิ่มคน" }).click();
  await expect(
    page.getByRole("heading", { name: "เพิ่มคน บูธเวิร์คช็อป" }),
  ).toBeVisible();
  await submitCode(page);
  await confirmSheet(page, walker, "เพิ่มผู้เข้าร่วมงาน");
  await expect(page.getByRole("status")).toContainText(
    `เพิ่ม ${name(walker)} เข้ารอบนี้แล้ว`,
  );

  // Again (success cleared the field): already in this round.
  await enterCode(page, walker.qr);
  await confirmSheet(page, walker, "เพิ่มผู้เข้าร่วมงาน");
  await dismissError(page, "เช็คอินแล้ว");

  // The list keeps the round. Other local data may share it, so counts are checked relatively.
  await page.getByRole("link", { name: "รายชื่อผู้เข้าร่วม" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname.endsWith("/participants") &&
      url.searchParams.get("session") === session,
  );
  const summary = page.getByLabel("สรุปจำนวน").getByRole("definition");
  await expect(summary).toHaveCount(3);
  const counts = async () => {
    const [arrived, booked, walkIns, total] = (await summary.allTextContents())
      .join(" ")
      .match(/\d+/g)!
      .map(Number);
    return { arrived, booked, walkIns, total };
  };
  const before = await counts();

  // The switch checks the booked attendee in.
  const toggle = page.getByRole("switch", { name: `เช็คอิน ${name(booker)}` });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(counts).toEqual({
    ...before,
    arrived: before.arrived + 1,
    total: before.total + 1,
  });

  // ลบออก asks first, then removes the walk-in.
  const walkInRow = page
    .locator("div", { hasText: name(walker) })
    .filter({ has: page.getByRole("button", { name: "ลบออก" }) })
    .last();
  await walkInRow.getByRole("button", { name: "ลบออก" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(name(walker));
  await confirm.getByRole("button", { name: "ลบออก" }).click();
  await expect(page.getByText(name(walker))).toHaveCount(0);
  await expect.poll(counts).toEqual({
    ...before,
    arrived: before.arrived + 1,
    walkIns: before.walkIns - 1,
    total: before.total,
  });

  // By keyboard: the dev toolbar floats over the bottom of the page.
  await page.getByRole("link", { name: "ย้อนกลับ" }).press("Enter");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/staff/workshop-check-in" &&
      url.searchParams.get("session") === session,
  );
});
