import { expect, test, type Page } from "@playwright/test";

// Registration flow: sign-in → registration form → PDPA → /myid, and the registration guards.
// Runs against the local D1 through the dev toolbar's fixture accounts: "attendee" is already
// registered; "New registration" signs in a fresh account each time, so nothing needs cleaning up.

/** Load a page and give SvelteKit time to hydrate (clicks before that do nothing). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Use one of the dev toolbar's session buttons. */
async function devSession(
  page: Page,
  button: "Use attendee" | "New registration",
) {
  await open(page, "/");
  const toggle = page.getByRole("button", { name: /DEV/ });
  await toggle.click();
  const panel = page.locator("#dev-toolbar-panel");
  await panel.getByRole("button", { name: button }).click();
  if (button === "New registration") {
    // The toolbar goes straight to the registration form.
    await expect(page).toHaveURL(/\/register$/);
    return;
  }
  await expect(panel.getByRole("status")).toHaveText(/^Signed in as /);
  await toggle.click();
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

test.describe.configure({ mode: "serial" });

test("a registered user skips the form for /myid", async ({ page }) => {
  await devSession(page, "Use attendee");
  await open(page, "/register");
  await expect(page).toHaveURL(/\/myid$/);
  await expect(page.getByText("dev-attendee-qr")).toBeVisible();
});

test("an unregistered user registers and lands on /myid", async ({ page }) => {
  // A fresh account: the toolbar takes it straight to the form.
  await devSession(page, "New registration");

  // Unregistered: every attendee page leads to the form.
  await open(page, "/myid");
  await expect(page).toHaveURL(/\/register$/);
  await page.waitForLoadState("networkidle");

  // The prefix picker shows no placeholder; it is the first picker on the form.
  await page.locator("[data-slot=picker-trigger]").first().click();
  await page
    .locator("[data-slot=picker-item]", { hasText: "นางสาว" })
    .first()
    .click();
  await page.fill("input[name=firstName]", "เอมะ");
  await page.fill("input[name=lastName]", "ซากุราบะ");
  await page.fill("input[name=age]", "15");
  await page.locator("[data-slot=select-trigger]").click();
  await page.getByRole("option", { name: "เชียงใหม่" }).click();
  await page.fill("input[name=emergencyPhone]", "0812345678");
  await page.fill("input[name=emergencyName]", "ฮิโระ นิไคโด");
  await page.fill("input[name=reason]", "อยากรู้จักคณะ");
  await page.fill("input[name=expectation]", "ได้ลองทำเวิร์คช็อป");
  await pick(page, "เลือกคำตอบ", "ตั้งใจมางานนี้");
  await pick(page, "เลือกสถานะ", "มัธยมศึกษาตอนปลาย");
  await page.fill("input[name=schoolName]", "โรงเรียนทดสอบ");
  // Three major pickers share a placeholder; pick the first by its label.
  const major1 = page.getByRole("button", {
    name: "สาขาวิชาที่สนใจ อันดับที่ 1",
  });
  await major1.click();
  await page
    .locator("[data-slot=picker]", { has: major1 })
    .locator("[data-slot=picker-item]", { hasText: "ฟิสิกส์" })
    .click();

  await page.getByRole("button", { name: "ถัดไป" }).click();
  await expect(page).toHaveURL(/step=pdpa/);
  await page.getByText("ยอมรับนโยบายข้อมูลส่วนบุคคล").click();
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();

  await expect(page).toHaveURL(/\/myid$/);
  await expect(page.getByText("เอมะ ซากุราบะ", { exact: true })).toBeVisible();

  // Registered now: the form is skipped.
  await open(page, "/register");
  await expect(page).toHaveURL(/\/myid$/);
});
