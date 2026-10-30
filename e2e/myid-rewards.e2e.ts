import { expect, test } from "@playwright/test";
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

test("/myid lists the reward tiers with the attendee's progress", async ({
  page,
}) => {
  await devSession(page, "Use attendee");
  await open(page, "/myid");

  const hunt = page.locator("section", {
    has: page.getByRole("heading", { name: "ภารกิจล่าของรางวัล" }),
  });
  for (const title of [
    "ลูกเรือโจรสลัด",
    "รองหัวหน้าโจรสลัด",
    "กัปตันโจรสลัด",
  ]) {
    await expect(hunt.getByRole("heading", { name: title })).toBeVisible();
  }
  // Counts come from getMyProgress ("–" would mean it failed to load).
  const crew = hunt.locator("article", {
    has: page.getByRole("heading", { name: "ลูกเรือโจรสลัด" }),
  });
  await expect(crew.getByText(/^บูธภาควิชา \d+\/6$/)).toBeVisible();
  await expect(crew).toContainText("หมอนเสืออ้วน");
});

test("/myid counts the attendee's scans and shows whether they redeemed", async ({
  page,
}) => {
  seedBooths();
  // A fresh attendee, so the counts start at zero.
  await devSession(page, "New registration");
  await completeRegistration(page, { firstName: "ความ", lastName: "คืบหน้า" });
  const userId = await sessionUserId(page);
  const [{ id: attendeeId }] = localD1Rows<{ id: string }>(
    `SELECT id FROM attendees WHERE user_id = '${userId}'`,
  );
  const gift = "e2e-myid-gift";
  try {
    stamp(attendeeId, { entry: "entry", tcas: true, booths: 2 });
    await open(page, "/myid");
    const crew = page.locator("article", {
      has: page.getByRole("heading", { name: "ลูกเรือโจรสลัด" }),
    });
    await expect(crew.getByText("บูธ TCAS 1/1")).toBeVisible();
    await expect(crew.getByText("กิจกรรมกลาง 0/1")).toBeVisible();
    await expect(crew.getByText("บูธภาควิชา 2/6")).toBeVisible();
    await expect(page.getByText("ยังไม่ได้แลกรับของรางวัล")).toBeVisible();

    localD1(`
      INSERT INTO reward_gifts (id, name, tier) VALUES ('${gift}', 'หมอนทดสอบ', 3);
      INSERT INTO reward_redemptions (id, attendee_id, checkpoint_id, gift_id, tier, gift_name)
      VALUES ('${gift}-redemption', '${attendeeId}', 'reward', '${gift}', 3, 'หมอนทดสอบ');
    `);
    await open(page, "/myid");
    await expect(page.getByText("แลกรับของรางวัลแล้ว")).toBeVisible();
  } finally {
    // The account stays, like the registration spec's; its scans and gift go.
    localD1(`
      DELETE FROM reward_redemptions WHERE attendee_id = '${attendeeId}';
      DELETE FROM reward_gifts WHERE id = '${gift}';
      DELETE FROM checkpoint_logs WHERE attendee_id = '${attendeeId}';
    `);
  }
});
