import { expect, test } from "@playwright/test";
import { devSession, open } from "./helpers";

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
