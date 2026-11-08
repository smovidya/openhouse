import { dev } from "$app/env";
import { env } from "cloudflare:workers";
import { error } from "@sveltejs/kit";
import { requireUser } from "#lib/features/auth/guards.server.ts";
import {
  certificateConfig,
  type CertificateEnv,
} from "#lib/features/certificates/config.server.ts";
import { database } from "#lib/features/certificates/service.server.ts";
import { currentIssuance } from "#lib/features/certificates/repository.server.ts";
import { CERTIFICATE_EVENT } from "#lib/features/certificates/shared.ts";
import type { RequestHandler } from "./$types";
export const GET: RequestHandler = async (event) => {
  const config = certificateConfig(env as CertificateEnv);
  if (
    event.url.origin !== config.eventOrigin &&
    !(dev && ["localhost", "127.0.0.1"].includes(event.url.hostname))
  )
    error(404, "Not found");
  const user = requireUser(event.locals.user);
  // The issuance lookup enforces attendee ownership, including legacy staff accounts.
  const db = database(env);
  const row = await currentIssuance(db, user.id, CERTIFICATE_EVENT.id);
  if (!row || row.revoked_at !== null) error(404, "ไม่พบเกียรติบัตร");
  if (!row.pdf_key || row.render_state !== "ready")
    error(409, "กรุณาเตรียมเกียรติบัตรก่อนดาวน์โหลด");
  const bucket = (env as CertificateEnv).CERTIFICATE_ASSETS;
  if (!bucket) error(503, "ระบบดาวน์โหลดยังไม่พร้อม");
  const pdf = await bucket.get(row.pdf_key);
  if (!pdf) error(503, "ไม่พบไฟล์ กรุณากลับไปลองเตรียมเกียรติบัตรอีกครั้ง");
  const current = await currentIssuance(db, user.id, CERTIFICATE_EVENT.id);
  if (!current || current.id !== row.id || current.revoked_at !== null)
    error(404, "เกียรติบัตรไม่พร้อมใช้งาน");
  return new Response(pdf.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="science-chula-certificate.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
};
