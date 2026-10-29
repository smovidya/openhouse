import { expect, test, type Page } from "@playwright/test";
import { deleteStaff, localD1, open, signInAsStaff } from "./helpers";

// Staff scanner pages, through the code form (the camera isn't available headless).
// The workshop pages run on mock attendance data (#lib/mock/workshop-attendance.svelte.ts).

test.describe.configure({ mode: "serial" });

// A registered attendee with a real-format code, plus an entry checkpoint to check in at.
const attendee = { id: "e2e-scan-attendee", qr: "E2E7Q", name: "สแกน ทดสอบ" };
const entryCheckpoint = "e2e-scan-entry";

let staffId: string | null = null;

test.beforeAll(() => {
  localD1(`
    DELETE FROM checkpoint_logs WHERE attendee_id = '${attendee.id}';
    INSERT OR IGNORE INTO users (id, google_id, email, name, role)
    VALUES ('${attendee.id}', '${attendee.id}', 'scan@example.com', 'Scan Test', 'attendee');
    INSERT OR IGNORE INTO attendees (id, qrCodeId, user_id, title, firstname, lastname, age, resident_province, type)
    VALUES ('${attendee.id}', '${attendee.qr}', '${attendee.id}', 'นาย', 'สแกน', 'ทดสอบ', 16, 'กรุงเทพมหานคร', 'student');
    INSERT OR IGNORE INTO checkpoints (id, name, type) VALUES ('${entryCheckpoint}', 'E2E entry', 'entry');
  `);
});

test.afterEach(() => {
  if (staffId) deleteStaff(staffId);
  staffId = null;
});

test.afterAll(() => {
  localD1(`
    DELETE FROM checkpoint_logs WHERE attendee_id = '${attendee.id}';
    DELETE FROM checkpoints WHERE id = '${entryCheckpoint}';
    DELETE FROM attendees WHERE id = '${attendee.id}';
    DELETE FROM users WHERE id = '${attendee.id}';
  `);
});

/** Switch to the code form, type `code` and submit it. */
async function enterCode(page: Page, code: string) {
  await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await page.getByLabel("กรอกรหัสของผู้ร่วมงาน").fill(code);
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
}

const sheet = (page: Page) => page.getByRole("dialog");

async function dismissError(page: Page, title: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "ตกลง" }).click();
  await expect(dialog).toBeHidden();
}

test("entry check-in looks up a typed code and checks the attendee in", async ({
  page,
}) => {
  staffId = await signInAsStaff(page, ["activityStaff"]);
  await open(page, "/staff/check-in");

  // Unknown codes fail the lookup with a dialog, not text.
  await enterCode(page, "zzzzz");
  await dismissError(page, "ไม่พบผู้เข้าร่วมงาน");

  // Typed in lower case: real codes are upper case.
  await page
    .getByLabel("กรอกรหัสของผู้ร่วมงาน")
    .fill(attendee.qr.toLowerCase());
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await expect(sheet(page).getByText(attendee.name)).toBeVisible();
  await expect(sheet(page).getByText("16 ปี")).toBeVisible();
  await sheet(page).getByRole("button", { name: "ตกลง" }).click();
  await expect(page.getByRole("status")).toContainText(
    `เช็คอิน ${attendee.name} แล้ว`,
  );
});

test("workshop check-in: booked-only check-in, walk-ins, and the participant list", async ({
  page,
}) => {
  staffId = await signInAsStaff(page, ["workshopStaff"]);
  await open(page, "/staff/workshop-check-in");
  await expect(
    page.getByRole("heading", { name: "เช็คอิน บูธเวิร์คช็อป" }),
  ).toBeVisible();
  // The participant list link carries the selected round.
  const listHref = await page
    .getByRole("link", { name: "รายชื่อผู้เข้าร่วม" })
    .getAttribute("href");
  const session = new URL(listHref!, "http://x").searchParams.get("session");
  expect(session).toMatch(/:\d+$/);

  // เช็คอิน only lets in attendees who booked this round (the mock books only the dev fixture).
  await enterCode(page, attendee.qr);
  await expect(
    sheet(page).getByRole("heading", { name: "เช็คอินผู้เข้าร่วมงาน" }),
  ).toBeVisible();
  await sheet(page).getByRole("button", { name: "ตกลง" }).click();
  await dismissError(page, "ไม่ได้ลงทะเบียนล่วงหน้า");

  // เพิ่มคน adds them as a walk-in.
  await page.getByRole("button", { name: "เพิ่มคน" }).click();
  await expect(
    page.getByRole("heading", { name: "เพิ่มคน บูธเวิร์คช็อป" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await expect(
    sheet(page).getByRole("heading", { name: "เพิ่มผู้เข้าร่วมงาน" }),
  ).toBeVisible();
  await sheet(page).getByRole("button", { name: "ตกลง" }).click();
  await expect(page.getByRole("status")).toContainText(
    `เพิ่ม ${attendee.name} เข้ารอบนี้แล้ว`,
  );

  // Again (success cleared the field): already in this round.
  await page.getByLabel("กรอกรหัสของผู้ร่วมงาน").fill(attendee.qr);
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await sheet(page).getByRole("button", { name: "ตกลง" }).click();
  await dismissError(page, "เช็คอินแล้ว");

  // The list keeps the round (client-side navigation keeps the mock's state).
  await page.getByRole("link", { name: "รายชื่อผู้เข้าร่วม" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname.endsWith("/participants") &&
      url.searchParams.get("session") === session,
  );
  const summary = page.getByLabel("สรุปจำนวน").getByRole("definition");
  await expect(summary).toHaveText(["1/3 คน", "1 คน", "2 คน"]);

  // The switch checks a booked attendee in.
  const toggle = page.getByRole("switch", { name: "เช็คอิน พัสกร ยืนยง" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(summary).toHaveText(["2/3 คน", "1 คน", "3 คน"]);

  // ลบออก asks first, then removes the walk-in.
  await page.getByRole("button", { name: "ลบออก" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(attendee.name);
  await confirm.getByRole("button", { name: "ลบออก" }).click();
  await expect(page.getByText("ยังไม่มีคนที่เพิ่ม")).toBeVisible();
  await expect(summary).toHaveText(["2/3 คน", "0 คน", "2 คน"]);

  // By keyboard: the dev toolbar floats over the bottom of the page.
  await page.getByRole("link", { name: "ย้อนกลับ" }).press("Enter");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/staff/workshop-check-in" &&
      url.searchParams.get("session") === session,
  );
});
