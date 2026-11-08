import puppeteer, { type Browser } from "@cloudflare/puppeteer";
import opentype from "opentype.js";
import QRCode from "qrcode";
import {
  CERTIFICATE_TEMPLATE as template,
  certificateTemplate,
} from "./template";
import type { CertificateEnv } from "./config.server";
import {
  finalizeCertificatePdf,
  type CertificatePdfMetadata,
} from "./pdf-properties.server";

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function certificateQr(url: string) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size + template.qr.quietZone * 2;
  const moduleMm = ((template.qr.size / template.width) * 297) / modules;
  if (moduleMm < template.qr.minimumModuleMm)
    throw new Error(
      "ชื่อยาวเกินกว่าจะสร้าง QR ที่อ่านได้ กรุณาติดต่อผู้จัดงาน",
    );
  return { modules, moduleMm };
}
export function certificateQrSvg(url: string) {
  certificateQr(url);
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const margin = template.qr.quietZone;
  const size = qr.modules.size + margin * 2;
  let path = "";
  // Filled module rectangles survive Chromium PDF printing without stroke thinning.
  for (let y = 0; y < qr.modules.size; y++) {
    for (let x = 0; x < qr.modules.size;) {
      if (!qr.modules.get(y, x)) {
        x++;
        continue;
      }
      const start = x;
      while (x < qr.modules.size && qr.modules.get(y, x)) x++;
      path += `M${start + margin} ${y + margin}h${x - start}v1h-${x - start}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path fill="#ffffff" d="M0 0h${size}v${size}H0z"/><path fill="#000000" d="${path}"/></svg>`;
}
function base64(bytes: Uint8Array) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 8192)
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
export async function trustedAsset(
  bucket: R2Bucket,
  asset: { key: string; sha256: string },
) {
  const object = await bucket.get(asset.key);
  if (!object) throw new Error("Certificate template unavailable");
  const bytes = await object.arrayBuffer();
  const digest = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== asset.sha256)
    throw new Error("Certificate asset checksum mismatch");
  return bytes;
}
export async function certificateHtml(
  env: CertificateEnv,
  name: string,
  url: string,
  school = "",
  templateVersion: string = template.version,
) {
  const selected = certificateTemplate(templateVersion);
  certificateQr(url);
  if (!env.CERTIFICATE_ASSETS)
    throw new Error("Certificate assets unavailable");
  const [background, fontBytes] = await Promise.all([
    trustedAsset(env.CERTIFICATE_ASSETS, selected.background),
    trustedAsset(env.CERTIFICATE_ASSETS, selected.font),
  ]);
  const qr = certificateQrSvg(url);
  const finePrint = "finePrint" in selected ? selected.finePrint : null;
  const font = opentype.parse(fontBytes);
  if ([...(name + school)].some((char) => !font.charToGlyphIndex(char)))
    throw new Error(
      "ชื่อมีตัวอักษรที่ฟอนต์เกียรติบัตรไม่รองรับ กรุณาติดต่อผู้จัดงาน",
    );
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
    @font-face{font-family:Certificate;src:url(data:font/ttf;base64,${base64(new Uint8Array(fontBytes))})}
    @page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;width:297mm;height:210mm;overflow:hidden}
    .page{width:2000px;height:1414px;position:relative;transform:scale(0.5612598425);transform-origin:top left}
    .art{position:absolute;width:2000px;height:1414px;inset:0}
    .name{position:absolute;left:${selected.name.x}px;top:${selected.name.y}px;width:${selected.name.width}px;height:${selected.name.height}px;background:white;display:flex;align-items:flex-start;padding-top:0;justify-content:center;color:#dfb441;font-family:Certificate;white-space:nowrap;font-size:${selected.name.maxFont}px;line-height:1.25}#school{position:absolute;left:312px;top:718px;width:1376px;height:42px;white-space:nowrap;text-align:center;font:30px Certificate;color:#927025;line-height:1.3}
    .qr{position:absolute;left:${selected.qr.x}px;top:${selected.qr.y}px;width:${selected.qr.size}px;height:${selected.qr.size}px;background:white}.qr svg{display:block;width:100%;height:100%}
    ${finePrint ? `.verification{position:absolute;left:${finePrint.x}px;bottom:${selected.height - finePrint.y - finePrint.height}px;width:${finePrint.width}px;max-height:${finePrint.height}px;padding:10px 12px;background:rgba(255,255,255,.88);border-radius:4px;font:${finePrint.fontSize}px/${finePrint.lineHeight}px monospace;color:#4b4b4b}.verification a{display:block;color:inherit;overflow-wrap:anywhere;word-break:break-all;text-decoration:none}` : ""}
    </style></head><body><div class="page"><img class="art" alt="" src="data:image/png;base64,${base64(new Uint8Array(background))}"><div class="name"><span id="name">${escapeHtml(name)}</span></div><div id="school">${escapeHtml(school)}</div><div class="qr">${qr}</div>${finePrint ? `<div class="verification"><a id="verification-link" href="${escapeHtml(url)}" aria-label="Verify this certificate">${escapeHtml(url)}</a></div>` : ""}</div></body></html>`;
}
export const fitCertificateLayout = ({
  minFont,
  maxFont,
  width,
  height,
}: {
  minFont: number;
  maxFont: number;
  width: number;
  height: number;
}) => {
  const text = document.getElementById("name")!;
  const container = text.parentElement!;
  for (let size = maxFont; size >= minFont; size--) {
    container.style.fontSize = `${size}px`;
    if (text.offsetWidth <= width - 24 && text.offsetHeight <= height - 42) {
      const school = document.getElementById("school")!;
      const verification =
        document.getElementById("verification-link")?.parentElement;
      const linkFits =
        !verification ||
        (verification.scrollHeight <= verification.clientHeight &&
          verification.scrollWidth <= verification.clientWidth);
      return (
        linkFits &&
        school.scrollWidth <= school.clientWidth &&
        school.scrollHeight <= school.clientHeight
      );
    }
  }
  return false;
};
// Preflight uses Chromium's Thai shaping and the exact same layout as the final PDF.
export async function renderCertificate(
  env: CertificateEnv,
  name: string,
  url: string,
  school = "",
  preflight = false,
  templateVersion: string = template.version,
  metadata?: CertificatePdfMetadata,
) {
  if (!env.CERTIFICATE_BROWSER)
    throw new Error("Certificate renderer unavailable");
  let browser: Browser | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  const task = (async () => {
    const html = await certificateHtml(env, name, url, school, templateVersion);
    if (expired) throw new Error("Certificate render timed out");
    browser = await puppeteer.launch(env.CERTIFICATE_BROWSER!);
    if (expired) {
      await browser.close();
      throw new Error("Certificate render timed out");
    }
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:")) void request.continue();
      else void request.abort();
    });
    await page.setContent(html, { waitUntil: "load", timeout: 35000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (!document.fonts.check("48px Certificate"))
        throw new Error("Certificate font unavailable");
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    const fits = await page.evaluate(
      fitCertificateLayout,
      certificateTemplate(templateVersion).name,
    );
    if (!fits)
      throw new Error("ชื่อยาวเกินพื้นที่เกียรติบัตร กรุณาติดต่อผู้จัดงาน");
    if (expired) throw new Error("Certificate render timed out");
    if (preflight) return null;
    if (!metadata) throw new Error("Certificate metadata unavailable");
    const bytes = new Uint8Array(
      await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, left: 0, right: 0, bottom: 0 },
        timeout: 35000,
      }),
    );
    return finalizeCertificatePdf(bytes, {
      ...metadata,
      name,
      school,
      verificationUrl: url,
      templateVersion,
    });
  })();
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("Certificate render timed out"));
        }, 45000);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
    if (browser) await browser.close();
  }
}
