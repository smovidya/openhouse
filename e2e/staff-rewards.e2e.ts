import { expect, test, type Page } from "@playwright/test";
import {
  deleteStaff,
  localD1,
  open,
  seedBooths,
  signInAsStaff,
} from "./helpers";

// The reward point (/staff/rewards) against the local D1, through the code form.

test.describe.configure({ mode: "serial" });

const attendee = {
  id: "e2e-reward-attendee",
  qr: "E2ER4",
  name: "รางวัล ทดสอบ",
};
const entryCheckpoint = "e2e-reward-entry";
const gift = { id: "e2e-reward-gift", name: "หมอนทดสอบ" };

function cleanUp() {
  localD1(`
    DELETE FROM reward_redemptions WHERE attendee_id = '${attendee.id}';
    DELETE FROM checkpoint_logs WHERE attendee_id = '${attendee.id}';
    DELETE FROM attendees WHERE id = '${attendee.id}';
    DELETE FROM users WHERE id = '${attendee.id}';
    DELETE FROM checkpoints WHERE id = '${entryCheckpoint}';
    DELETE FROM reward_gifts WHERE id = '${gift.id}';
  `);
}

let staffId: string | null = null;

test.beforeAll(() => {
  seedBooths();
  cleanUp();
  // Tier 3 (ลูกเรือโจรสลัด): entered, TCAS, the central activity and 6 department booths.
  localD1(`
    INSERT INTO users (id, google_id, email, name, role)
    VALUES ('${attendee.id}', '${attendee.id}', '${attendee.id}@example.com', 'Reward Test', 'attendee');
    INSERT INTO attendees (id, qrCodeId, user_id, title, firstname, lastname, age, resident_province, type)
    VALUES ('${attendee.id}', '${attendee.qr}', '${attendee.id}', 'นาย', 'รางวัล', 'ทดสอบ', 16, 'กรุงเทพมหานคร', 'student');
    INSERT INTO checkpoints (id, name, type) VALUES ('${entryCheckpoint}', 'E2E entry', 'entry');
    INSERT INTO checkpoint_logs (id, attendee_id, checkpoint_id)
    SELECT '${attendee.id}-' || id, '${attendee.id}', id FROM checkpoints
    WHERE deleted_at IS NULL AND (
      id = '${entryCheckpoint}' OR type IN ('tcas', 'central_activity')
      OR id IN (SELECT id FROM checkpoints WHERE type = 'booth' AND deleted_at IS NULL ORDER BY id LIMIT 6)
    );
    INSERT INTO reward_gifts (id, name, tier) VALUES ('${gift.id}', '${gift.name}', 3);
  `);
});

test.afterEach(() => {
  if (staffId) deleteStaff(staffId);
  staffId = null;
});

test.afterAll(cleanUp);

async function lookUp(page: Page) {
  const field = page.getByLabel("กรอกรหัสของผู้ร่วมงาน");
  if (!(await field.isVisible()))
    await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await field.fill(attendee.qr);
  await page.getByRole("button", { name: "ตรวจสอบ", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "รับของรางวัล" }),
  ).toBeVisible();
  await expect(sheet.getByText(attendee.name)).toBeVisible();
  return sheet;
}

test("the reward point shows the tiers, redeems the highest reached, then locks", async ({
  page,
}) => {
  staffId = await signInAsStaff(page, ["activityStaff"]);
  await open(page, "/staff/rewards");
  await expect(
    page.getByRole("table", { name: "เงื่อนไขแลกของรางวัลในแต่ละขั้น" }),
  ).toContainText("กัปตันโจรสลัด");

  // Tier 3 reached: the sheet says what's being redeemed and what the next tier needs.
  let sheet = await lookUp(page);
  await expect(sheet.getByText(`${attendee.id}@example.com`)).toBeVisible();
  await expect(sheet.getByText("“กำลังแลก ลูกเรือโจรสลัด”")).toBeVisible();
  await expect(sheet.getByText(`ของรางวัล: ${gift.name}`)).toBeVisible();
  await expect(sheet).toContainText(
    "ขั้นถัดไป (รองหัวหน้าโจรสลัด) ขาด: บูธภาควิชาอีก 6 บูธ, เวิร์คช็อปอีก 1 กิจกรรม",
  );
  await sheet.getByRole("button", { name: "ยืนยันการรับของ" }).click();
  await expect(page.getByRole("status")).toContainText(
    `มอบ${gift.name}ให้ ${attendee.name} แล้ว`,
  );

  // Redeemed: scanning again explains why it can't be redeemed twice.
  sheet = await lookUp(page);
  await expect(sheet.getByRole("alert")).toHaveText(`แลก${gift.name}ไปแล้ว`);
  await expect(
    sheet.getByRole("button", { name: "ยืนยันการรับของ" }),
  ).toBeDisabled();
});
