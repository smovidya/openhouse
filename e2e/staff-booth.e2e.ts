import { expect, test, type Page } from "@playwright/test";
import {
  deleteAttendees,
  deleteStaff,
  fullName,
  insertAttendees,
  localD1,
  open,
  seedBooths,
  signInAsStaff,
  stamp,
  type TestAttendee,
} from "./helpers";

// Booth check-in (/staff/booth-check-in) against the local D1, through the code form.

test.describe.configure({ mode: "serial" });

// A seeded department booth (scripts/seed-booths.ts).
const booth = { id: "booth-biology", name: "ชีววิทยา", department: "biology" };

const attendee = (key: string, firstname: string): TestAttendee => ({
  id: `e2e-booth-${key}`,
  qr: `E2E-BOOTH-${key.toUpperCase()}`,
  firstname,
  lastname: "ทดสอบ",
});
const visitor = attendee("visitor", "มาบูธ");
const outsider = attendee("outsider", "ยังไม่เข้างาน");
const redeemed = attendee("redeemed", "แลกแล้ว");
const attendees = [visitor, outsider, redeemed];

let staffId: string | null = null;

test.beforeAll(() => {
  seedBooths();
  deleteAttendees(attendees.map((a) => a.id));
  insertAttendees(attendees);
  stamp(visitor.id, { entry: "entry" });
  stamp(redeemed.id, { entry: "entry", tcas: true, central: true, booths: 6 });
  localD1(`
    INSERT INTO reward_redemptions (id, attendee_id, checkpoint_id, tier)
    VALUES ('${redeemed.id}-redemption', '${redeemed.id}', 'reward', 3);
  `);
});

test.afterEach(() => {
  if (staffId) deleteStaff(staffId);
  staffId = null;
});

test.afterAll(() => deleteAttendees(attendees.map((a) => a.id)));

async function enterCode(page: Page, who: TestAttendee) {
  const field = page.getByLabel("กรอกรหัสของผู้ร่วมงาน");
  if (!(await field.isVisible()))
    await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await field.fill(who.qr);
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
}

/** Confirm the sheet, checking it shows `who` at the booth. */
async function confirmSheet(page: Page, who: TestAttendee) {
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "เช็คอินผู้เข้าร่วมงาน" }),
  ).toBeVisible();
  await expect(sheet.getByText(fullName(who))).toBeVisible();
  await expect(sheet.getByText(booth.name)).toBeVisible();
  await sheet.getByRole("button", { name: "ตกลง" }).click();
}

async function dismissError(page: Page, title: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "ตกลง" }).click();
  await expect(dialog).toBeHidden();
}

test("department staff check attendees in at their booth", async ({ page }) => {
  staffId = await signInAsStaff(page, [`boothStaff:${booth.department}`]);
  // From the menu: their only booth is already picked.
  await open(page, "/staff");
  await page.getByRole("link", { name: "เช็คอินบูธนิทรรศการ" }).click();
  await expect(page).toHaveURL(/\/staff\/booth-check-in$/);
  await expect(page.locator("[data-slot=picker-trigger]")).toContainText(
    booth.name,
  );

  await enterCode(page, visitor);
  await confirmSheet(page, visitor);
  await expect(page.getByRole("status")).toContainText(
    `เช็คอิน ${fullName(visitor)} ที่ ${booth.name} แล้ว`,
  );

  // A repeat scan says so instead of failing.
  await enterCode(page, visitor);
  await confirmSheet(page, visitor);
  await expect(page.getByRole("status")).toContainText(
    `${fullName(visitor)} เช็คอิน ${booth.name} ไปแล้วก่อนหน้านี้`,
  );

  // Not through the entry point yet.
  await enterCode(page, outsider);
  await confirmSheet(page, outsider);
  await dismissError(page, "ยังไม่ได้ผ่านจุดลงทะเบียน");

  // Redeemed their reward: booths are closed to them.
  await enterCode(page, redeemed);
  await confirmSheet(page, redeemed);
  await dismissError(page, "แลกของรางวัลไปแล้ว");
});

test("staff with several booths pick one first", async ({ page }) => {
  staffId = await signInAsStaff(page, ["boothStaff:all"]);
  await open(page, "/staff/booth-check-in");

  await enterCode(page, visitor);
  await dismissError(page, "กรุณาเลือกบูธ");

  const picker = page.locator("[data-slot=picker]");
  await picker.locator("[data-slot=picker-trigger]").click();
  // Exact: "ชีววิทยา" is also part of "จุลชีววิทยา".
  await picker.getByRole("radio", { name: booth.name, exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("checkpoint") === booth.id,
  );
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await confirmSheet(page, visitor);
  // The first test's check-in went with its staff account (deleteStaff).
  await expect(page.getByRole("status")).toContainText(
    `เช็คอิน ${fullName(visitor)} ที่ ${booth.name} แล้ว`,
  );

  // The history button is hidden until that page has data.
  await expect(
    page.getByRole("link", { name: "ดูประวัติการเช็คอิน" }),
  ).toHaveCount(0);
});
