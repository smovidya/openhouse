import { expect, test, type Page } from "@playwright/test";
import {
  deleteAttendees,
  deleteStaff,
  fullName,
  insertAttendees,
  localD1,
  open,
  seedBooths,
  seedWorkshops,
  signInAsStaff,
  stamp,
  type TestAttendee,
} from "./helpers";

// The reward point (/staff/rewards) against the local D1, through the code form. Assumes the
// local D1 has no reward gifts of its own: each test adds the ones it needs.

test.describe.configure({ mode: "serial" });

const attendee = (key: string, firstname: string): TestAttendee => ({
  id: `e2e-reward-${key}`,
  qr: `E2E-REWARD-${key.toUpperCase()}`,
  firstname,
  lastname: "ทดสอบ",
});
const crew = attendee("crew", "ลูกเรือ");
const outsider = attendee("outsider", "ยังไม่เข้างาน");
const beginner = attendee("beginner", "เพิ่งเริ่ม");
const deputy = attendee("deputy", "รองหัวหน้า");
const chooser = attendee("chooser", "เลือกของ");
const climber = attendee("climber", "เลื่อนขั้น");
const dropout = attendee("dropout", "หลุดเกณฑ์");
const legacy = attendee("legacy", "แลกก่อนหน้า");
const attendees = [
  crew,
  outsider,
  beginner,
  deputy,
  chooser,
  climber,
  dropout,
  legacy,
];

/** Tier 3 (ลูกเรือโจรสลัด): entered, TCAS, the central activity and 6 department booths. */
const crewStamps = { entry: "entry", tcas: true, central: true, booths: 6 };

let staffId: string | null = null;
const gifts: string[] = [];

function addGift(id: string, name: string, tier: 1 | 2 | 3) {
  gifts.push(id);
  localD1(
    `INSERT INTO reward_gifts (id, name, tier) VALUES ('${id}', '${name}', ${tier});`,
  );
}

test.beforeAll(() => {
  seedBooths();
  seedWorkshops();
  deleteAttendees(attendees.map((a) => a.id));
  insertAttendees(attendees);
  stamp(crew.id, crewStamps);
  // Scanned around without passing the entry point.
  stamp(outsider.id, { tcas: true, central: true, booths: 6 });
  stamp(beginner.id, { entry: "entry" });
  // Tier 2: 12 booths and a workshop.
  stamp(deputy.id, {
    ...crewStamps,
    booths: 12,
    workshopSlots: ["workshop-geo-map-2"],
  });
  stamp(chooser.id, crewStamps);
  stamp(climber.id, crewStamps);
  stamp(dropout.id, crewStamps);
  // Redeemed before gifts were recorded: the redemption has no gift name.
  stamp(legacy.id, crewStamps);
  localD1(`
    INSERT INTO reward_redemptions (id, attendee_id, checkpoint_id, tier)
    VALUES ('${legacy.id}-redemption', '${legacy.id}', 'reward', 3);
  `);
});

test.afterEach(() => {
  if (staffId) deleteStaff(staffId);
  staffId = null;
  if (gifts.length > 0) {
    const list = gifts.map((id) => `'${id}'`).join(", ");
    localD1(`
      DELETE FROM reward_redemptions WHERE gift_id IN (${list});
      DELETE FROM reward_gifts WHERE id IN (${list});
    `);
    gifts.length = 0;
  }
});

test.afterAll(() => deleteAttendees(attendees.map((a) => a.id)));

async function openRewards(page: Page, permissions = ["activityStaff"]) {
  staffId = await signInAsStaff(page, permissions);
  await open(page, "/staff/rewards");
}

/** Look `who` up through the code form; returns the sheet. */
async function lookUp(page: Page, who: TestAttendee) {
  const field = page.getByLabel("กรอกรหัสของผู้ร่วมงาน");
  if (!(await field.isVisible()))
    await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await field.fill(who.qr);
  await page.getByRole("button", { name: "ตรวจสอบ", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "รับของรางวัล" }),
  ).toBeVisible();
  await expect(sheet.getByText(fullName(who))).toBeVisible();
  return sheet;
}

const confirmButton = (sheet: ReturnType<Page["getByRole"]>) =>
  sheet.getByRole("button", { name: "ยืนยันการรับของ" });

async function dismissError(page: Page, title: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "ตกลง" }).click();
  await expect(dialog).toBeHidden();
}

test("redeems the highest tier reached once, then locks; workshops stay open", async ({
  page,
}) => {
  addGift("e2e-reward-gift", "หมอนทดสอบ", 3);
  await openRewards(page, ["activityStaff", "workshopStaff"]);
  await expect(
    page.getByRole("table", { name: "เงื่อนไขแลกของรางวัลในแต่ละขั้น" }),
  ).toContainText("กัปตันโจรสลัด");

  // Tier 3 reached: the sheet says what's being redeemed and what the next tier needs.
  let sheet = await lookUp(page, crew);
  await expect(sheet.getByText(`${crew.id}@example.com`)).toBeVisible();
  await expect(sheet.getByText("“กำลังแลก ลูกเรือโจรสลัด”")).toBeVisible();
  await expect(sheet.getByText("ของรางวัล: หมอนทดสอบ")).toBeVisible();
  await expect(sheet).toContainText(
    "ขั้นถัดไป (รองหัวหน้าโจรสลัด) ขาด: บูธภาควิชาอีก 6 บูธ, เวิร์คช็อปอีก 1 กิจกรรม",
  );
  await confirmButton(sheet).click();
  await expect(page.getByRole("status")).toContainText(
    `มอบหมอนทดสอบให้ ${fullName(crew)} แล้ว`,
  );

  // Redeemed: scanning again explains why it can't be redeemed twice.
  sheet = await lookUp(page, crew);
  await expect(sheet.getByRole("alert")).toHaveText("แลกหมอนทดสอบไปแล้ว");
  await expect(confirmButton(sheet)).toBeDisabled();
  await sheet.getByRole("button", { name: "ยกเลิก" }).click();

  // Re-scanned at the entry point after redeeming: already checked in, not an error.
  await open(page, "/staff/check-in");
  await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await page.getByLabel("กรอกรหัสของผู้ร่วมงาน").fill(crew.qr);
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ตกลง" }).click();
  await expect(page.getByRole("status")).toContainText(
    `${fullName(crew)} เช็คอินไปแล้วก่อนหน้านี้`,
  );

  // Workshops stay open after redemption (the backend locks only the other checkpoints).
  await open(page, "/staff/workshop-check-in?session=geo-map%3A3");
  await page.getByRole("button", { name: "เพิ่มคน" }).click();
  await page.getByRole("button", { name: "กรอกรหัส" }).click();
  await page.getByLabel("กรอกรหัสของผู้ร่วมงาน").fill(crew.qr);
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ตกลง" }).click();
  await expect(page.getByRole("status")).toContainText(
    `เพิ่ม ${fullName(crew)} เข้ารอบนี้แล้ว`,
  );
});

test("explains why an attendee can't redeem yet", async ({ page }) => {
  addGift("e2e-reward-gift", "หมอนทดสอบ", 3);
  await openRewards(page);

  // Not through the entry point.
  let sheet = await lookUp(page, outsider);
  await expect(sheet.getByRole("alert")).toHaveText(
    "ยังไม่ได้ผ่านจุดลงทะเบียน",
  );
  await expect(confirmButton(sheet)).toBeDisabled();
  await sheet.getByRole("button", { name: "ยกเลิก" }).click();

  // Entered, nothing else: what tier 3 needs, and the booths still to visit.
  sheet = await lookUp(page, beginner);
  await expect(sheet.getByRole("alert")).toHaveText("ยังไม่ผ่านเกณฑ์ขั้นใด");
  await expect(sheet).toContainText(
    "ขั้นถัดไป (ลูกเรือโจรสลัด) ขาด: บูธ TCAS, กิจกรรมกลาง, บูธภาควิชาอีก 6 บูธ",
  );
  await expect(sheet.getByText(/^บูธที่ยังไม่ได้เก็บ \(\d+\)$/)).toBeVisible();
  await expect(confirmButton(sheet)).toBeDisabled();
  await sheet.getByRole("button", { name: "ยกเลิก" }).click();

  // Redeemed before gifts were recorded.
  sheet = await lookUp(page, legacy);
  await expect(sheet.getByRole("alert")).toHaveText("แลกของรางวัลไปแล้ว");
  await expect(confirmButton(sheet)).toBeDisabled();
  await sheet.getByRole("button", { name: "ยกเลิก" }).click();

  // Tier 2 reached, but no tier 2 gift configured.
  sheet = await lookUp(page, deputy);
  await expect(sheet.getByRole("alert")).toHaveText(
    "ยังไม่ได้ตั้งค่าของรางวัลของขั้นนี้ กรุณาติดต่อผู้ดูแลระบบ",
  );
  await expect(confirmButton(sheet)).toBeDisabled();
});

test("lets staff pick between a tier's gifts", async ({ page }) => {
  addGift("e2e-reward-gift-a", "หมอนลายเสือ", 3);
  addGift("e2e-reward-gift-b", "หมอนลายปลา", 3);
  await openRewards(page);

  const sheet = await lookUp(page, chooser);
  const picker = sheet.locator("[data-slot=picker]");
  await picker.locator("[data-slot=picker-trigger]").click();
  await picker
    .locator("[data-slot=picker-item]", { hasText: "หมอนลายปลา" })
    .click();
  await confirmButton(sheet).click();
  await expect(page.getByRole("status")).toContainText(
    `มอบหมอนลายปลาให้ ${fullName(chooser)} แล้ว`,
  );
});

test("refuses a handover when progress changed after the preview", async ({
  page,
}) => {
  addGift("e2e-reward-gift", "หมอนทดสอบ", 3);
  await openRewards(page);

  // Moved up to tier 2 while the sheet showed tier 3.
  let sheet = await lookUp(page, climber);
  await expect(sheet.getByText("“กำลังแลก ลูกเรือโจรสลัด”")).toBeVisible();
  localD1(`DELETE FROM checkpoint_logs WHERE attendee_id = '${climber.id}';`);
  stamp(climber.id, {
    ...crewStamps,
    booths: 12,
    workshopSlots: ["workshop-geo-map-2"],
  });
  await confirmButton(sheet).click();
  await dismissError(page, "ข้อมูลเปลี่ยนไปแล้ว");

  // No longer reaches any tier.
  sheet = await lookUp(page, dropout);
  await expect(sheet.getByText("“กำลังแลก ลูกเรือโจรสลัด”")).toBeVisible();
  localD1(
    `DELETE FROM checkpoint_logs WHERE attendee_id = '${dropout.id}' AND checkpoint_id = 'tcas';`,
  );
  await confirmButton(sheet).click();
  await dismissError(page, "ยังไม่ผ่านเกณฑ์");
});
