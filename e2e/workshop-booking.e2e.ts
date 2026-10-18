import { expect, test, type Page } from "@playwright/test";
import {
  completeRegistration,
  devSession,
  freezeClock,
  localD1,
  open,
  seedWorkshops,
} from "./helpers";

// Workshop booking against the local D1: the registration window, booking a round, one round per
// workshop, time clashes, the advance-booking limit (2), and the bookings on /myid.
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

test("an attendee books workshops within the rules", async ({ page }) => {
  await devSession(page, "New registration");
  await completeRegistration(page, {
    firstName: "ทดสอบ",
    lastName: "เวิร์กช็อป",
  });
  await expect(
    page.getByText("เวิร์กช็อปที่ลงทะเบียนแล้ว (0/2)"),
  ).toBeVisible();

  // Before the window opens (real clock: before 20 Oct 18:00), booking is refused.
  await open(page, "/workshop/perfume");
  await round(page, "perfume:1").click();
  await expect(page.getByRole("alert")).toContainText(
    "ยังไม่เปิดให้ลงทะเบียนเวิร์กช็อป",
  );
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "available",
  );

  // Window open: book Perfume round 1 (Sat 13:00).
  await freezeClock(page, "Workshops open");
  await open(page, "/workshop/perfume");
  await round(page, "perfume:1").click();
  await expect(round(page, "perfume:1")).toHaveAttribute(
    "data-status",
    "registered",
  );
  // One round per workshop.
  await expect(round(page, "perfume:2")).toHaveAttribute(
    "data-status",
    "other-round",
  );

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

  // A third workshop is over the advance-booking limit.
  await open(page, "/workshop/geo-map");
  await round(page, "geo-map:2").click(); // Sat 14:15, no clash
  await expect(page.getByRole("alert")).toContainText(
    "ลงทะเบียนล่วงหน้าได้สูงสุด 2 เวิร์กช็อป",
  );
  await expect(round(page, "geo-map:2")).toHaveAttribute(
    "data-status",
    "available",
  );

  // Both bookings on /myid.
  await open(page, "/myid");
  await expect(
    page.getByText("เวิร์กช็อปที่ลงทะเบียนแล้ว (2/2)"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfume" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Little Beads, Big Ideas" }),
  ).toBeVisible();
});
