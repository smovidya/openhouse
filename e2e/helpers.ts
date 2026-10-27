import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

// Shared steps for the e2e specs. They run against the local D1 through the dev toolbar:
// "Use attendee" is an already registered fixture; "New registration" signs in a fresh account.

/** Load a page and give SvelteKit time to hydrate (clicks before that do nothing). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Open the dev toolbar on the current page and run `action` in its panel, then close it. */
async function inDevToolbar(
  page: Page,
  action: (panel: ReturnType<Page["locator"]>) => Promise<void>,
) {
  const toggle = page.getByRole("button", { name: /DEV/ });
  await toggle.click();
  const panel = page.locator("#dev-toolbar-panel");
  await action(panel);
  if (await panel.isVisible()) await toggle.click();
}

/** Use one of the dev toolbar's session buttons. */
export async function devSession(
  page: Page,
  button: "Use attendee" | "New registration",
) {
  await open(page, "/");
  await inDevToolbar(page, async (panel) => {
    await panel.getByRole("button", { name: button }).click();
    if (button === "New registration") {
      // The toolbar goes straight to the registration form.
      await expect(page).toHaveURL(/\/register$/);
    } else {
      await expect(panel.getByRole("status")).toHaveText(/^Signed in as /);
    }
  });
}

/** Freeze the server's clock for this browser at one of the dev toolbar's schedule presets. */
export async function freezeClock(
  page: Page,
  preset: "Workshops open" | "Workshops close",
) {
  await open(page, "/");
  await inDevToolbar(page, async (panel) => {
    await panel.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
    await expect(panel.getByRole("status")).toHaveText(preset);
  });
}

/** Freeze the server's clock for this browser at a Bangkok local time, e.g. "2026-10-20T17:00". */
export async function freezeClockAt(page: Page, bangkokTime: string) {
  await open(page, "/");
  await inDevToolbar(page, async (panel) => {
    await panel.getByLabel("Bangkok time (UTC+07:00)").fill(bangkokTime);
    await panel.getByRole("button", { name: "Freeze time" }).click();
    await expect(panel.getByRole("status")).toHaveText("Clock frozen");
  });
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

/** Fill the registration form (on /register), accept PDPA and submit; lands on /myid. */
export async function completeRegistration(
  page: Page,
  { firstName, lastName }: { firstName: string; lastName: string },
) {
  // The prefix picker shows no placeholder; it is the first picker on the form.
  await page.locator("[data-slot=picker-trigger]").first().click();
  await page
    .locator("[data-slot=picker-item]", { hasText: "นางสาว" })
    .first()
    .click();
  await page.fill("input[name=firstName]", firstName);
  await page.fill("input[name=lastName]", lastName);
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
}

/** Run SQL (or a package script) against the local D1. */
export function localD1(sql: string) {
  // Wrangler's own script under Node, without a shell, so the SQL reaches it as one argument.
  const wrangler = join(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  execFileSync(
    process.execPath,
    [wrangler, "d1", "execute", "DB", "--local", "--command", sql],
    {
      stdio: "pipe",
    },
  );
}

/** Make sure the workshops exist in the local D1 (the seed is repeat-safe). */
export function seedWorkshops() {
  execFileSync("bun", ["run", "workshops:seed"], {
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}
