import { test, expect } from "@playwright/test";
import {
  completeRegistration,
  devSession,
  localD1,
  localD1Rows,
  open,
  seedBooths,
  sessionUserId,
  stamp,
} from "./helpers";
test("certificate review preserves typing, shows corrections and school, resets approval, traps and returns focus", async ({
  page,
}, testInfo) => {
  seedBooths();
  await devSession(page, "New registration");
  await completeRegistration(page, { firstName: "สมชาย", lastName: "ใจดี" });
  const user = await sessionUserId(page);
  const [{ id }] = localD1Rows<{ id: string }>(
    `SELECT id FROM attendees WHERE user_id='${user}'`,
  );
  stamp(id, { entry: "entry" });
  localD1(
    `INSERT INTO survey_responses(id,attendee_id,answer) VALUES('${id}-certificate-evaluation','${id}','{}')`,
  );
  await page.setViewportSize({ width: 375, height: 600 });
  await open(page, "/myid");
  const trigger = page.getByRole("button", {
    name: "รับเกียรติบัตร",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("สถานศึกษา (ถ้ามี)")).toHaveValue(
    "โรงเรียนทดสอบ",
  );
  const first = dialog.getByLabel("ชื่อ", { exact: true });
  await first.fill("  เเABCก  ");
  await expect(first).toHaveValue("  เเABCก  ");
  await dialog
    .getByRole("button", { name: "ตรวจสอบชื่อ", exact: true })
    .click();
  await expect(
    dialog.getByText("มีการปรับรูปอักษร กรุณาตรวจสอบ"),
  ).toBeVisible();
  await expect(
    dialog.getByText("นางสาว แก ใจดี", { exact: true }),
  ).toBeVisible();
  await expect(first).toHaveValue("  เเABCก  ");
  await dialog.getByLabel("สถานศึกษา (ถ้ามี)").fill("โรงเรียนเตรียมอุดมศึกษา");
  await expect(
    dialog.getByRole("button", { name: "ยืนยัน", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "ตรวจสอบชื่อ", exact: true })
    .click();
  await expect(
    dialog.getByText("โรงเรียนเตรียมอุดมศึกษา", { exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("certificate-review-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("ชื่อ", { exact: true })).toHaveValue("สมชาย");
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(dialog).not.toBeVisible();
  const stored = localD1Rows<{ firstname: string; school: string }>(
    `SELECT firstname,school FROM attendees WHERE id='${id}'`,
  )[0];
  expect(stored).toEqual({ firstname: "สมชาย", school: "โรงเรียนทดสอบ" });
});
