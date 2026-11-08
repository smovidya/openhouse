import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import { finalizeCertificatePdf } from "../src/lib/features/certificates/pdf-properties.server";
import { execFileSync } from "node:child_process";
import { generateKeyPair, exportJWK } from "jose";
import { readBarcodes, prepareZXingModule } from "zxing-wasm/reader";
import {
  certificateHtml,
  fitCertificateLayout,
  certificateQr,
} from "../src/lib/features/certificates/renderer.server";
import {
  signCertificate,
  verificationUrl,
} from "../src/lib/features/certificates/token.server";
import {
  CERTIFICATE_EVENT,
  reviewName,
} from "../src/lib/features/certificates/shared";
import { CERTIFICATE_TEMPLATE } from "../src/lib/features/certificates/template";
import type { CertificateEnv } from "../src/lib/features/certificates/config.server";
const assets =
  existsSync("เกียรติบัตร.png") &&
  existsSync("certificate-assets/Sarabun-Regular.ttf");
test.skip(!assets, "Private certificate test assets are required");
async function configuration() {
  const keys = await generateKeyPair("ES256", { extractable: true });
  const kid = "preview-render-test";
  const env = {
    CERTIFICATE_EVENT_ORIGIN: "https://event.preview.test",
    CERTIFICATE_ISSUER: "https://verify.preview.test",
    CERTIFICATE_PRIVATE_JWK: JSON.stringify({
      ...(await exportJWK(keys.privateKey)),
      kid,
    }),
    CERTIFICATE_PUBLIC_KEYS: JSON.stringify([
      { ...(await exportJWK(keys.publicKey)), kid },
    ]),
    CERTIFICATE_ASSETS: {
      async get(key: string) {
        const file = key.endsWith(".png")
          ? "เกียรติบัตร.png"
          : "certificate-assets/Sarabun-Regular.ttf";
        return {
          async arrayBuffer() {
            const bytes = readFileSync(file);
            return bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            );
          },
        };
      },
    },
  } as unknown as CertificateEnv;
  return env;
}
test("certificate is one A4 page with Thai name and school; its printed QR decodes", async ({
  page,
}, testInfo) => {
  const env = await configuration();
  const name = reviewName({
    title: "mr",
    customTitle: "",
    firstName: "ชนินทร์",
    lastName: "พัฒนวงศ์",
    school: "โรงเรียนสาธิตจุฬาลงกรณ์มหาวิทยาลัย ฝ่ายมัธยม",
  });
  const issuanceId = crypto.randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signCertificate(env, {
    id: issuanceId,
    certificateId: crypto.randomUUID(),
    name,
    now: issuedAt,
  });
  const url = verificationUrl(env, token);
  expect(certificateQr(url).moduleMm).toBeGreaterThanOrEqual(0.3);
  await page.setViewportSize({ width: 1123, height: 794 });
  await page.setContent(
    await certificateHtml(env, name.displayName, url, name.school),
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(fitCertificateLayout, CERTIFICATE_TEMPLATE.name),
  ).toBe(true);
  await expect(page.locator("#name")).toHaveText(name.displayName);
  await expect(page.locator("#school")).toHaveText(name.school);
  const finePrint = page.locator("#verification-link");
  await expect(finePrint).toHaveText(url);
  await expect(finePrint).toHaveAttribute("href", url);
  const linkBox = await finePrint.boundingBox();
  expect(linkBox).not.toBeNull();
  expect(linkBox!.y + linkBox!.height).toBeLessThan(794);
  const pdf = testInfo.outputPath("certificate.pdf");
  const rendered = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, left: 0, right: 0, bottom: 0 },
  });
  const finalized = await finalizeCertificatePdf(rendered, {
    issuanceId,
    issuedAt,
    event: CERTIFICATE_EVENT,
    name: name.displayName,
    school: name.school,
    verificationUrl: url,
    templateVersion: CERTIFICATE_TEMPLATE.version,
  });
  writeFileSync(pdf, finalized);
  const pdfDocument = await PDFDocument.load(finalized, {
    updateMetadata: false,
  });
  expect(pdfDocument.getTitle()).toBe(
    `${CERTIFICATE_EVENT.title} - Participation Certificate - ${name.displayName}`,
  );
  expect(pdfDocument.getAuthor()).toBe(
    "Faculty of Science, Chulalongkorn University",
  );
  expect(pdfDocument.getSubject()).toContain(CERTIFICATE_EVENT.awardDate);
  expect(pdfDocument.getCreationDate()).toEqual(new Date(issuedAt * 1000));
  expect(
    pdfDocument.catalog.getOrCreateViewerPreferences().getDisplayDocTitle(),
  ).toBe(true);
  const properties = pdfDocument.context.lookup(
    pdfDocument.context.trailerInfo.Info!,
    PDFDict,
  );
  for (const [key, value] of Object.entries({
    CertificateID: issuanceId,
    RecipientName: name.displayName,
    School: name.school,
    AwardDate: CERTIFICATE_EVENT.awardDate,
    TemplateVersion: CERTIFICATE_TEMPLATE.version,
    VerificationURL: url,
  })) {
    expect(properties.lookup(PDFName.of(key), PDFHexString).decodeText()).toBe(
      value,
    );
  }
  expect(properties.has(PDFName.of("Email"))).toBe(false);
  expect(properties.has(PDFName.of("UserID"))).toBe(false);
  const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  expect(info).toMatch(/Pages:\s+1/);
  expect(info).toMatch(/Page size:.*\(A4\)/);
  const text = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" });
  expect(text).not.toContain("ศรุตา");
  expect(text).toContain("โรงเรียน");
  expect(text.replace(/\s+/g, "")).toContain(url);
  const linkedUrls = execFileSync("pdfinfo", ["-url", pdf], {
    encoding: "utf8",
  });
  expect(linkedUrls).toContain(url);
  const raster = testInfo.outputPath("print-300dpi");
  execFileSync("pdftoppm", ["-png", "-r", "300", "-singlefile", pdf, raster]);
  prepareZXingModule({
    overrides: {
      wasmBinary: readFileSync(
        "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
      ),
    },
  });
  const decoded = await readBarcodes(
    new Uint8Array(readFileSync(raster + ".png")),
    { formats: ["QRCode"], tryHarder: true },
  );
  expect(decoded.map((result) => result.text)).toContain(url);
  await page.screenshot({ path: testInfo.outputPath("certificate.png") });
  await testInfo.attach("certificate", {
    path: testInfo.outputPath("certificate.png"),
    contentType: "image/png",
  });
  // A physically oversized name is rejected rather than clipped or truncated.
  await page
    .locator("#name")
    .evaluate((node) => (node.textContent = "W".repeat(180)));
  expect(
    await page.evaluate(fitCertificateLayout, CERTIFICATE_TEMPLATE.name),
  ).toBe(false);
});

test("existing v2 certificates retain their original layout", async ({
  page,
}) => {
  const env = await configuration();
  await page.setContent(
    await certificateHtml(
      env,
      "นาย สมชาย ใจดี",
      "https://verify.preview.test/c/existing",
      "School",
      "openhouse-2027-v2",
    ),
  );
  await expect(page.locator("#verification-link")).toHaveCount(0);
  await expect(page.locator(".qr")).toBeVisible();
});

test("three simultaneous local renders complete with the same immutable details", async ({
  browser,
}, testInfo) => {
  const env = await configuration();
  const name = reviewName({
    title: "mr",
    customTitle: "",
    firstName: "สมชาย",
    lastName: "ใจดี",
    school: "โรงเรียนเตรียมอุดมศึกษา",
  });
  const token = await signCertificate(env, {
    id: crypto.randomUUID(),
    certificateId: crypto.randomUUID(),
    name,
    now: Math.floor(Date.now() / 1000),
  });
  const html = await certificateHtml(
    env,
    name.displayName,
    verificationUrl(env, token),
    name.school,
  );
  const times = await Promise.all(
    Array.from({ length: 3 }, async () => {
      const start = performance.now();
      const page = await browser.newPage();
      try {
        await page.setContent(html);
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(fitCertificateLayout, CERTIFICATE_TEMPLATE.name),
        ).toBe(true);
        const pdf = await page.pdf({
          format: "A4",
          landscape: true,
          printBackground: true,
          preferCSSPageSize: true,
        });
        expect(pdf.length).toBeGreaterThan(10000);
        return Math.round(performance.now() - start);
      } finally {
        await page.close();
      }
    }),
  );
  await testInfo.attach("local-render-latency-ms", {
    body: JSON.stringify(times),
    contentType: "application/json",
  });
});
