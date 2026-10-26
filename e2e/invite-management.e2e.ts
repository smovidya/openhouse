import { expect, test, type Page } from "@playwright/test";
import { devSession, localD1, open } from "./helpers";

test.describe.configure({ mode: "serial" });

const testUsers = new Set<string>();
const testInvites = new Set<string>();
test.afterEach(() => {
  const statements = [
    ...[...testInvites].map(
      (id) => `DELETE FROM invite_codes WHERE id = '${id}';`,
    ),
    ...[...testUsers].flatMap((id) => [
      `DELETE FROM staffs WHERE user_id = '${id}';`,
      `DELETE FROM users WHERE id = '${id}';`,
    ]),
  ];
  if (statements.length) localD1(statements.join("\n"));
  testUsers.clear();
  testInvites.clear();
});

// Use fresh local accounts so these checks never change an existing admin.
async function newcomerId(page: Page) {
  await devSession(page, "New registration");
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "vidyachula-session-dev",
  );
  expect(cookie).toBeDefined();
  const { sub } = JSON.parse(
    Buffer.from(cookie!.value.split(".")[1], "base64url").toString(),
  );
  expect(sub).toMatch(/^dev-user-newcomer-[a-f0-9-]+$/);
  testUsers.add(sub);
  return sub as string;
}

function grant(userId: string, permission: "admin" | "workshopStaff") {
  localD1(`
    INSERT INTO staffs (id, user_id, type, name, phone, permission)
    VALUES ('${userId}', '${userId}', 'test', 'Invite test', '0000000000', '["${permission}"]');
    UPDATE users SET role = 'staff' WHERE id = '${userId}';
  `);
}

test("only admins can open invite management or see its menu link", async ({
  page,
}) => {
  await open(page, "/staff/invites");
  await expect(page).toHaveURL(/\/staff$/);

  const userId = await newcomerId(page);
  expect((await page.goto("/staff/invites"))?.status()).toBe(403);
  grant(userId, "workshopStaff");
  await open(page, "/staff");
  await expect(page.getByRole("link", { name: "จัดการรหัสเชิญ" })).toHaveCount(
    0,
  );
  expect((await page.goto("/staff/invites"))?.status()).toBe(403);
});

test("admin creates, copies, and disables an invite; revoked admins cannot create", async ({
  page,
  browser,
}, testInfo) => {
  const adminId = await newcomerId(page);
  grant(adminId, "admin");
  await open(page, "/staff");
  await page.getByRole("link", { name: "จัดการรหัสเชิญ" }).click();
  await expect(
    page.getByRole("heading", { name: "จัดการรหัสเชิญ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "สร้างรหัสเชิญ", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "เวิร์คช็อป", exact: true }).check();
  await page.getByRole("checkbox", { name: /ผู้ดูแลระบบ \(Admin\)/ }).check();

  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes("_app/remote/"),
  );
  await page
    .getByRole("button", { name: "สร้างรหัสเชิญ", exact: true })
    .click();
  const createRequest = await requestPromise;
  const fresh = page.getByRole("region", { name: "รหัสเชิญใหม่" });
  await expect(fresh).toBeVisible();
  const id = (await fresh.getByText(/^ID: /).innerText()).slice(4);
  expect(id).toMatch(/^[a-f0-9-]+$/);
  testInvites.add(id);
  const code = await page
    .getByRole("textbox", { name: "รหัสเชิญใหม่", exact: true })
    .inputValue();
  expect(code).toMatch(/^[a-f0-9]{48}$/);
  const row = page.getByRole("article", {
    name: `รหัสเชิญ ${id}`,
    exact: true,
  });
  await expect(row.getByText("ใช้งานอยู่", { exact: true })).toBeVisible();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await fresh.getByRole("button", { name: "คัดลอกรหัส", exact: true }).click();
  await expect(fresh.getByRole("status")).toHaveText("คัดลอกรหัสแล้ว");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await fresh.getByRole("button", { name: "บันทึกรหัสแล้ว ปิด" }).click();
  await expect(fresh).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("invite-management.png"),
    fullPage: true,
  });

  const recipientContext = await browser.newContext({
    baseURL: "http://localhost:5174",
  });
  try {
    const recipient = await recipientContext.newPage();
    await newcomerId(recipient);
    await open(recipient, "/staff");
    await recipient.getByLabel("ชื่อ-นามสกุล").fill("Invite recipient");
    await recipient.getByLabel("เบอร์โทรศัพท์").fill("0812345678");
    await recipient.locator("#staff-code").fill(code);
    await recipient
      .getByRole("button", { name: "ลงทะเบียนสตาฟ", exact: true })
      .click();
    await expect(
      recipient.getByRole("link", { name: "จัดการรหัสเชิญ" }),
    ).toBeVisible();

    await row.getByRole("button", { name: "ปิดใช้งาน", exact: true }).click();
    await expect(row.getByText("ปิดใช้งานแล้ว", { exact: true })).toBeVisible();
    await open(page, "/staff/invites");
    await expect(row.getByText("ปิดใช้งานแล้ว", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "รหัสเชิญใหม่", exact: true }),
    ).toHaveCount(0);

    await recipient.getByLabel("เพิ่มสิทธิ์ด้วยรหัสเชิญ").fill(code);
    await recipient
      .getByRole("button", { name: "เพิ่มสิทธิ์", exact: true })
      .click();
    await expect(recipient.getByRole("alert")).toHaveText(
      "รหัสเชิญไม่ถูกต้อง หรือถูกปิดใช้งานแล้ว",
    );
    // Disabling a code must not remove grants already redeemed.
    await open(recipient, "/staff/invites");
    await expect(
      recipient.getByRole("heading", { name: "จัดการรหัสเชิญ" }),
    ).toBeVisible();
  } finally {
    await recipientContext.close();
  }

  // A stale admin tab must not retain access to the underlying commands.
  localD1(
    `UPDATE staffs SET permission = '["workshopStaff"]' WHERE user_id = '${adminId}';`,
  );
  const denied = await page.request.post(createRequest.url(), {
    headers: {
      "content-type": createRequest.headers()["content-type"],
      origin: "http://localhost:5174",
    },
    data: createRequest.postData()!,
  });
  // SvelteKit commands return HTTP 200 with the application error in the body.
  expect(await denied.json()).toMatchObject({
    type: "error",
    error: { status: 403 },
  });
  expect((await page.goto("/staff/invites"))?.status()).toBe(403);
});

test("admin can page through older codes and invalid pages are rejected", async ({
  page,
}) => {
  const adminId = await newcomerId(page);
  grant(adminId, "admin");
  const ids = Array.from({ length: 21 }, () => crypto.randomUUID());
  for (const id of ids) testInvites.add(id);
  localD1(
    `INSERT INTO invite_codes (id, code_hash, permission, created_at) VALUES ${ids
      .map(
        (id, index) =>
          `('${id}', lower(hex(randomblob(32))), '["workshopStaff"]', ${4102444800 + index})`,
      )
      .join(",")};`,
  );

  await open(page, "/staff/invites");
  await expect(page.getByRole("article")).toHaveCount(20);
  await expect(page.getByRole("article").first()).toHaveAccessibleName(
    `รหัสเชิญ ${ids[20]}`,
  );
  await expect(page.getByRole("article").last()).toHaveAccessibleName(
    `รหัสเชิญ ${ids[1]}`,
  );
  await page.getByRole("link", { name: "ถัดไป", exact: true }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(page.getByRole("article").first()).toHaveAccessibleName(
    `รหัสเชิญ ${ids[0]}`,
  );
  await page.getByRole("link", { name: "ก่อนหน้า", exact: true }).click();
  await expect(page).toHaveURL(/\?page=1$/);
  await expect(page.getByRole("article").first()).toHaveAccessibleName(
    `รหัสเชิญ ${ids[20]}`,
  );
  for (const value of ["0", "-1", "abc", "1.5", "100001"]) {
    expect((await page.goto(`/staff/invites?page=${value}`))?.status()).toBe(
      400,
    );
  }
});

test("admin creates a custom code for department, TCAS, and central activity scopes", async ({
  page,
  browser,
}) => {
  const adminId = await newcomerId(page);
  grant(adminId, "admin");
  await open(page, "/staff/invites");
  const code = `Booth-Team-${crypto.randomUUID()}`;
  const customInput = page.getByLabel("รหัสเชิญที่กำหนดเอง (ไม่บังคับ)");
  await customInput.fill(code);
  await page
    .getByRole("button", { name: "เลือกบูธที่ดูแล", exact: true })
    .click();
  for (const name of ["บูธ ฟิสิกส์", "TCAS", "กิจกรรมส่วนกลาง"])
    await page.getByRole("checkbox", { name, exact: true }).check();
  await page
    .getByRole("button", { name: "สร้างรหัสเชิญ", exact: true })
    .click();

  const fresh = page.getByRole("region", { name: "รหัสเชิญใหม่" });
  await expect(fresh).toBeVisible();
  const id = (await fresh.getByText(/^ID: /).innerText()).slice(4);
  expect(id).toMatch(/^[a-f0-9-]+$/);
  testInvites.add(id);
  await expect(
    page.getByRole("textbox", { name: "รหัสเชิญใหม่", exact: true }),
  ).toHaveValue(code);
  for (const permission of [
    "boothStaff:physics",
    "boothStaff:tcas",
    "boothStaff:central-activity",
  ])
    await expect(fresh).toContainText(permission);
  await fresh.getByRole("button", { name: "บันทึกรหัสแล้ว ปิด" }).click();

  // A duplicate remains an actionable form error; it never replaces the original grants.
  await customInput.fill(` ${code} `);
  // The multi-picker stays open after creating a code.
  await page.getByRole("checkbox", { name: "TCAS", exact: true }).check();
  await page
    .getByRole("button", { name: "สร้างรหัสเชิญ", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "รหัสเชิญนี้ถูกใช้แล้ว กรุณาเลือกรหัสใหม่",
  );
  await expect(customInput).toHaveValue(` ${code} `);
  await expect(fresh).toHaveCount(0);

  const recipientContext = await browser.newContext({
    baseURL: "http://localhost:5174",
  });
  try {
    const recipient = await recipientContext.newPage();
    await newcomerId(recipient);
    await open(recipient, "/staff");
    await recipient.getByLabel("ชื่อ-นามสกุล").fill("Scoped booth staff");
    await recipient.getByLabel("เบอร์โทรศัพท์").fill("0812345678");
    await recipient.locator("#staff-code").fill(code);
    await recipient
      .getByRole("button", { name: "ลงทะเบียนสตาฟ", exact: true })
      .click();
    await expect(
      recipient.getByRole("heading", { name: /เมนูสตาฟ/ }),
    ).toBeVisible();
    await expect(
      recipient.getByRole("link", { name: "จัดการรหัสเชิญ" }),
    ).toHaveCount(0);
    await expect(recipient.getByText("สิทธิ์ปัจจุบัน:")).toContainText(
      "boothStaff:tcas",
    );
    expect((await recipient.goto("/staff/invites"))?.status()).toBe(403);
  } finally {
    await recipientContext.close();
  }
});
