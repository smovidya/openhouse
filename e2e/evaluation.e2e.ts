import { expect, test, type Page } from "@playwright/test";
import {
  devSession,
  freezeClockAt,
  localD1,
  localD1Rows,
  open,
  seedBooths,
  stamp,
} from "./helpers";

// The evaluation form (ฟอร์มประเมินผล): time gate → entry gate → one-way submit →
// "ขอบคุณ" state → the certificate card on /myid points to the later download.
// Uses the shared "dev-attendee" fixture; cleans its own rows to stay repeatable.

test.describe.configure({ mode: "serial" });

/** The entry checkpoint's actual id (either "entry" or "checkpoint-entry", depending on what's seeded). */
function entryCheckpointId() {
  const [row] = localD1Rows<{ id: string }>(
    "SELECT id FROM checkpoints WHERE type = 'entry' AND deleted_at IS NULL LIMIT 1",
  );
  return row.id;
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

/** Every 1–4 satisfaction question, keyed by its radio group's aria-label. */
const ratingLabels = [
  "กิจกรรมในบูธต่าง ๆ น่าสนใจและเป็นประโยชน์",
  "ความแออัดของสถานที่จัดงาน",
  "ความสะดวกในการเดินทางมาเข้าร่วมงาน",
  "ความเพียงพอของห้องสุขา",
  "ความเหมาะสมของจุดพยาบาล",
  "ความสะอาดภายในงานและจุดทิ้งขยะ",
  "เว็บไซต์ง่ายต่อการเข้าถึง",
  "เว็บไซต์ใช้งานง่าย",
  "เว็บไซต์มีความสวยงาม",
  "ท่านได้รับข้อมูลเกี่ยวกับงานครบถ้วน ไม่สับสน",
  "ระยะเวลาลงทะเบียนเวิร์กช็อปเหมาะสม",
  "สามารถเข้าร่วมเวิร์กช็อปได้ตามต้องการ",
  "ของที่ระลึกที่ได้มีความเหมาะสม",
  "เนื้อหาสาระกิจกรรมตรงตามความคาดหวัง",
  "ความพึงพอใจต่องานโดยรวม",
  "หากมีโอกาสหน้าท่านจะแนะนำ Sci Chula Openhouse แก่ผู้อื่น",
  "เนื้อหาตรงกับที่คาดหวังในภาควิชา",
  "ความเหมาะสมในการสื่อสารของผู้ปฏิบัติงานประจำบูธ",
  "ความน่าสนใจของสื่อที่ใช้ในการนำเสนอภาควิชา",
];

test("evaluates once the attendee checks in, and locks after submitting", async ({
  page,
}) => {
  // The dev toolbar floats bottom-center by default and would cover the submit
  // button at the end of the long form; park it top-right for this spec.
  await page.addInitScript(() => {
    localStorage.setItem("dev:toolbarPosition", JSON.stringify("top-right"));
  });

  // Repeat-safe: remove this spec's traces from earlier runs of the fixture.
  localD1(`
    DELETE FROM survey_responses WHERE attendee_id = 'dev-attendee';
    DELETE FROM checkpoint_logs WHERE attendee_id = 'dev-attendee';
  `);
  seedBooths();

  await devSession(page, "Use attendee");

  // Before the event starts the form stays closed.
  await freezeClockAt(page, "2026-10-20T12:00");
  await open(page, "/evaluation");
  await expect(page.getByText("แบบประเมินยังไม่เปิด")).toBeVisible();

  // During the event, the attendee must have checked in first.
  await freezeClockAt(page, "2026-10-31T13:01");
  await open(page, "/evaluation");
  await expect(page.getByText("เช็คอินก่อนทำแบบประเมิน")).toBeVisible();

  // Check in at the entry point; now the questionnaire appears.
  stamp("dev-attendee", { entry: entryCheckpointId() });
  await open(page, "/evaluation");
  await expect(
    page.getByRole("heading", { name: "จุดประสงค์การเข้าร่วม" }),
  ).toBeVisible();

  // An invalid submit scrolls to the first unanswered question (ภาควิชา),
  // instead of leaving the view at the bottom by the submit button.
  await pick(page, "เลือกจุดประสงค์", "สนใจศึกษาต่อ");
  await page.getByRole("button", { name: "ส่งแบบประเมิน" }).click();
  await expect(
    page.getByText("ภาควิชาที่มีความสนใจ (เลือกได้มากกว่า 1 สาขา)"),
  ).toBeInViewport();

  // Fill every required field.
  await pick(page, "เลือกภาควิชา", "ฟิสิกส์");
  await pick(page, "เลือกบูธที่ชื่นชอบ", "ฟิสิกส์");
  for (const label of ratingLabels) {
    await page
      .getByRole("radiogroup", { name: label })
      .getByRole("button", { name: "4" })
      .click();
  }
  await pick(page, "เลือกคำตอบ", "ขอพิจารณาก่อน");
  await page.locator("textarea[name=comment]").fill("สนุกมากเลยครับ");

  await page.getByRole("button", { name: "ส่งแบบประเมิน" }).click();
  await expect(page.getByText("ส่งแบบประเมินเรียบร้อย")).toBeVisible();

  // One row in D1 holding the submitted answers (Non-PII only).
  const rows = localD1Rows<{ answer: string }>(
    "SELECT answer FROM survey_responses WHERE attendee_id = 'dev-attendee' AND deleted_at IS NULL",
  );
  expect(rows).toHaveLength(1);
  const answer = JSON.parse(rows[0].answer) as Record<string, unknown>;
  expect(answer.purpose).toContain("study");
  expect(answer.comment).toBe("สนุกมากเลยครับ");

  // Revisiting shows the done state, not the form again.
  await open(page, "/evaluation");
  await expect(page.getByText("ส่งแบบประเมินเรียบร้อย")).toBeVisible();
  await expect(page.getByRole("button", { name: "ส่งแบบประเมิน" })).toHaveCount(
    0,
  );

  // The certificate card on /myid follows up with the download-later note.
  await open(page, "/myid");
  await expect(page.getByText("ส่งแบบประเมินแล้ว")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "@scichulaopenhouse" }),
  ).toHaveAttribute("href", "https://www.instagram.com/scichulaopenhouse");
});
