import { expect, test } from "@playwright/test";
import { completeRegistration, devSession, open } from "./helpers";

// Registration flow: sign-in → registration form → PDPA → /myid, and the registration guards.
// "New registration" signs in a fresh account each time, so nothing needs cleaning up.

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

  await completeRegistration(page, { firstName: "เอมะ", lastName: "ซากุราบะ" });
  await expect(page.getByText("เอมะ ซากุราบะ", { exact: true })).toBeVisible();

  // Registered now: the form is skipped.
  await open(page, "/register");
  await expect(page).toHaveURL(/\/myid$/);
});
