import { expect, test, type Page } from "@playwright/test";
import {
  completeRegistration,
  devSession,
  freezeClock,
  freezeClockAt,
  localD1,
  open,
  seedWorkshops,
} from "./helpers";

// Workshop booking against the local D1: the registration window, booking a round (and its seat
// count), one round per workshop, time clashes, the advance-booking limit (2), the bookings on
// /myid (linking to their workshop) and on the list, and moving to another round by cancelling
// first (there is no in-place change) through the confirmation dialog.
// Each run registers a fresh attendee; their bookings are removed afterwards so seats don't run out.

test.describe.configure({ mode: "serial" });
test.beforeAll(seedWorkshops);
test.afterAll(() =>
  localD1(
    `DELETE FROM workshop_registrations WHERE attendee_id IN (SELECT id FROM attendees WHERE user_id LIKE 'dev-user-newcomer-%')`,
  ),
);

/** A round's row on a workshop page, by `<slug>:<round>`. */
const round = (page: Page, id: string) =>
  page.locator(`[data-session="${id}"]`);

/** A round's booked seats ("จำนวน x/y" → x). */
async function seats(page: Page, id: string) {
  const text = await round(page, id).textContent();
  const match = text?.match(/จำนวน (\d+)\/\d+/);
  expect(match, `seat count on ${id}`).not.toBeNull();
  return Number(match![1]);
}

/** A workshop's card on /workshop, by its title. */
const listCard = (page: Page, title: string) =>
  page.locator("article", { has: page.getByRole("heading", { name: title }) });

test("an attendee books workshops within the rules", async ({ page }) => {
  await devSession(page, "New registration");
  await completeRegistration(page, {
    firstName: "ทดสอบ",
    lastName: "เวิร์กช็อป",
  });
  await expect(
    page.getByText("เวิร์กช็อปที่ลงทะเบียนแล้ว (0/2)"),
  ).toBeVisible();

  // Before the window opens (20 Oct 18:00), booking is refused.
  await freezeClockAt(page, "2026-10-20T17:00");
  await open(page, "/workshop/perfume");
  await round(page, "perfume:1").click();
  await expect(page.getByRole("alert")).toContainText(
    "ยังไม่เปิดให้ลงทะเบียนเวิร์กช็อป",
  );
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "available",
  );

  // Window open: book Perfume round 1 (Sat 13:00); its seat count goes up by one.
  await freezeClock(page, "Workshops open");
  await open(page, "/workshop/perfume");
  const before = await seats(page, "perfume:1");
  await round(page, "perfume:1").click();
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "registered",
  );
  expect(await seats(page, "perfume:1")).toBe(before + 1);
  // One round per workshop: the other round isn't pressable and says to cancel first.
  await expect(round(page, "perfume:2")).toHaveAttribute(
    "data-status",
    "other-round",
  );
  await expect(round(page, "perfume:2")).toContainText("ยกเลิกรอบเดิมก่อน");
  await expect(page.locator('button[data-session="perfume:2"]')).toHaveCount(0);

  // Little Beads round 1 is also Sat 13:00: a clash. Round 2 (Sat 15:30) is free.
  await open(page, "/workshop/little-beads-big-ideas");
  await expect(round(page, "little-beads-big-ideas:1")).toHaveAttribute(
    "data-status",
    "conflict",
  );
  await round(page, "little-beads-big-ideas:2").click();
  await expect(round(page, "little-beads-big-ideas:2")).toHaveAttribute(
    "data-status",
    "registered",
  );

  // A third workshop is over the advance-booking limit: its rounds say so and can't be pressed.
  await open(page, "/workshop/geo-map");
  await expect(round(page, "geo-map:2")).toHaveAttribute(
    "data-status",
    "limit",
  ); // Sat 14:15, no clash
  await expect(round(page, "geo-map:2")).toContainText("ครบ 2 เวิร์กช็อปแล้ว");
  await expect(page.locator('button[data-session="geo-map:2"]')).toHaveCount(0);

  // The list marks the booked workshops.
  await open(page, "/workshop");
  await expect(listCard(page, "Perfume").getByRole("link")).toHaveText(
    "ลงทะเบียนแล้ว",
  );
  await expect(
    listCard(page, "Little Beads, Big Ideas").getByRole("link"),
  ).toHaveText("ลงทะเบียนแล้ว");
  await expect(
    listCard(page, "สำรวจเกาะ เจาะแผนที่").getByRole("link"),
  ).toHaveText("ลงทะเบียน");

  // Both bookings on /myid, each linking to its workshop.
  await open(page, "/myid");
  await expect(
    page.getByText("เวิร์กช็อปที่ลงทะเบียนแล้ว (2/2)"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfume" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Little Beads, Big Ideas" }),
  ).toBeVisible();
  await page.locator('a[href="/workshop/perfume"]').click();
  await expect(page).toHaveURL(/\/workshop\/perfume$/);

  // Moving to another round: cancel the booked one (after confirming), then book the other.
  const dialog = page.getByRole("alertdialog");
  await round(page, "perfume:1").click();
  await expect(dialog).toContainText("ยกเลิกการลงทะเบียน?");
  await dialog.getByRole("button", { name: "ไม่ใช่" }).click();
  await expect(dialog).toBeHidden();
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "registered",
  );
  await round(page, "perfume:1").click();
  await dialog.getByRole("button", { name: "ยกเลิกการลงทะเบียน" }).click();
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "available",
  );
  expect(await seats(page, "perfume:1")).toBe(before);
  await round(page, "perfume:2").click(); // Sat 16:45
  await expect(round(page, "perfume:2")).toHaveAttribute(
    "data-status",
    "registered",
  );
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "other-round",
  );

  // Pressing the booked round again cancels it, after confirming.
  await round(page, "perfume:2").click();
  await expect(dialog).toContainText("ยกเลิกการลงทะเบียน?");
  await dialog.getByRole("button", { name: "ยกเลิกการลงทะเบียน" }).click();
  await expect(round(page, "perfume:2")).toHaveAttribute(
    "data-status",
    "available",
  );
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "available",
  );

  await open(page, "/myid");
  await expect(
    page.getByText("เวิร์กช็อปที่ลงทะเบียนแล้ว (1/2)"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfume" })).toBeHidden();
});
