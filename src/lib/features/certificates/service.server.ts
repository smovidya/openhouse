import { CERTIFICATE_TEMPLATE } from "./template";
import { error } from "@sveltejs/kit";
import { normalizationReady } from "./normalization";
import { certificateConfigured, type CertificateEnv } from "./config.server";
import {
  CERTIFICATE_EVENT,
  registrationCertificateName,
  reviewName,
  sameName,
  type CertificateState,
  type Confirmation,
} from "./shared";
import {
  claimLease,
  completeLease,
  currentIssuance,
  eligibilitySql,
  issueStatements,
  replacementStatements,
  snapshotName,
  type Issuance,
  type NewIssuance,
} from "./repository.server";
import { renderCertificate } from "./renderer.server";
import { signCertificate, verificationUrl } from "./token.server";

export const database = (env: CertificateEnv) =>
  env.DB.withSession("first-primary");
function publicIssuance(
  row: Issuance,
): NonNullable<CertificateState["issuance"]> {
  return {
    id: row.id,
    name: snapshotName(row),
    event: JSON.parse(row.event_snapshot),
    status: row.revoked_at !== null ? "revoked" : row.render_state,
  };
}
export async function myCertificate(
  env: CertificateEnv,
  userId: string,
): Promise<CertificateState> {
  const db = database(env);
  const profile = await db
    .prepare(
      `SELECT a.title,a.prefix_other AS prefixOther,a.firstname,a.lastname,a.school,(${eligibilitySql}) AS eligible
    FROM attendees a WHERE a.user_id=? ORDER BY (a.deleted_at IS NULL) DESC,a.created_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{
      title: string;
      prefixOther: string | null;
      school: string | null;
      firstname: string;
      lastname: string;
      eligible: number;
    }>();
  if (!profile) error(404, "ไม่พบข้อมูลลงทะเบียน");
  const issuance = await currentIssuance(db, userId, CERTIFICATE_EVENT.id);
  return {
    eligible: Boolean(profile.eligible),
    configured: normalizationReady && certificateConfigured(env),
    raw: registrationCertificateName(profile),
    issuance: issuance ? publicIssuance(issuance) : null,
  };
}
function confirmedName(input: Confirmation) {
  if (!normalizationReady)
    error(503, "ระบบกำลังเตรียมการตรวจสอบชื่อ กรุณาลองภายหลัง");
  const name = reviewName(input.raw);
  if (!sameName(name, input.reviewed))
    error(409, "ข้อมูลเปลี่ยนแปลง กรุณาตรวจสอบชื่ออีกครั้ง");
  return name;
}
async function newIssuance(
  env: CertificateEnv,
  input: Confirmation,
  certificateId: string,
  event = CERTIFICATE_EVENT,
): Promise<NewIssuance> {
  if (!certificateConfigured(env))
    error(503, "ระบบเกียรติบัตรยังไม่พร้อม กรุณาลองภายหลัง");
  const name = confirmedName(input);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const token = await signCertificate(env, {
    id,
    certificateId,
    name,
    now,
    event,
  });
  await renderCertificate(
    env,
    name.displayName,
    verificationUrl(env, token),
    name.school,
    true,
  );
  return {
    id,
    certificateId,
    name,
    event: JSON.stringify(event),
    token,
    template: CERTIFICATE_TEMPLATE.version,
    now,
  };
}
export async function confirmCertificate(
  env: CertificateEnv,
  userId: string,
  input: Confirmation,
) {
  const name = confirmedName(input);
  const db = database(env);
  let row = await currentIssuance(db, userId, CERTIFICATE_EVENT.id);
  if (!row) {
    const state = await myCertificate(env, userId);
    if (!state.eligible) error(403, "ต้องเช็คอินเข้างานและส่งแบบประเมินก่อน");
    try {
      const candidate = await newIssuance(env, input, crypto.randomUUID());
      await db.batch(
        issueStatements(db, userId, CERTIFICATE_EVENT.id, candidate),
      );
    } catch (cause) {
      // Another confirmation can commit while preflight is waiting for Chromium.
      // Recover that winner even if this redundant render failed.
      if (!(await currentIssuance(db, userId, CERTIFICATE_EVENT.id)))
        throw cause;
    }
    row = await currentIssuance(db, userId, CERTIFICATE_EVENT.id);
  }
  if (!row)
    error(
      403,
      "ต้องมีการลงทะเบียนที่ใช้งานอยู่ เช็คอินเข้างาน และส่งแบบประเมินก่อน",
    );
  if (row.revoked_at !== null)
    error(409, "เกียรติบัตรถูกเพิกถอน กรุณาติดต่อผู้จัดงาน");
  if (!sameName(snapshotName(row), name))
    error(
      409,
      "ชื่อและสถานศึกษาถูกยืนยันแล้ว หากต้องการแก้ไขกรุณาติดต่อผู้จัดงาน",
    );
  return myCertificate(env, userId);
}
export async function prepareCertificate(env: CertificateEnv, userId: string) {
  const db = database(env);
  const row = await currentIssuance(db, userId, CERTIFICATE_EVENT.id);
  if (!row) error(409, "กรุณายืนยันชื่อก่อน");
  if (row.revoked_at !== null)
    error(409, "เกียรติบัตรถูกเพิกถอน กรุณาติดต่อผู้จัดงาน");
  if (!env.CERTIFICATE_ASSETS) error(503, "ระบบเกียรติบัตรยังไม่พร้อม");
  if (row.render_state === "ready" && row.pdf_key) {
    if (await env.CERTIFICATE_ASSETS.head(row.pdf_key))
      return myCertificate(env, userId);
    await db
      .prepare(
        `UPDATE certificate_issuances SET render_state='failed',pdf_key=NULL WHERE id=? AND revoked_at IS NULL`,
      )
      .bind(row.id)
      .run();
  }
  const owner = crypto.randomUUID();
  const lease = await claimLease(
    db,
    row.id,
    owner,
    Math.floor(Date.now() / 1000),
  );
  if (!lease) return myCertificate(env, userId);
  try {
    // No normalization on download: use the committed snapshot and exact stored token.
    const pdf = await renderCertificate(
      env,
      row.display_name,
      verificationUrl(env, row.token),
      row.school,
      false,
      row.template_version,
      {
        issuanceId: row.id,
        issuedAt: row.created_at,
        event: JSON.parse(row.event_snapshot),
      },
    );
    if (!pdf) throw new Error("Empty PDF");
    const key = `certificates/${row.template_version}/${row.id}.pdf`;
    // Recheck lease ownership and revocation before storage as well as before ready.
    const active = await db
      .prepare(
        `SELECT id FROM certificate_issuances WHERE id=? AND lease_owner=? AND lease_until>? AND revoked_at IS NULL`,
      )
      .bind(row.id, owner, Math.floor(Date.now() / 1000))
      .first();
    if (!active) return myCertificate(env, userId);
    await env.CERTIFICATE_ASSETS.put(key, pdf, {
      httpMetadata: {
        contentType: "application/pdf",
        cacheControl: "private, no-store",
      },
    });
    await completeLease(db, row.id, owner, key, Math.floor(Date.now() / 1000));
  } catch {
    await db
      .prepare(
        `UPDATE certificate_issuances SET render_state='failed',lease_owner=NULL,lease_until=NULL WHERE id=? AND lease_owner=? AND revoked_at IS NULL`,
      )
      .bind(row.id, owner)
      .run();
  }
  return myCertificate(env, userId);
}
export async function lookupCertificate(env: CertificateEnv, lookup: string) {
  const db = database(env);
  const entitlement = await db
    .prepare(
      `SELECT c.id,c.current_issuance_id FROM certificates c JOIN attendees a ON a.id=c.attendee_id
    WHERE c.event_id=? AND (a.qrCodeId=? OR c.id=? OR EXISTS (SELECT 1 FROM certificate_issuances i WHERE i.certificate_id=c.id AND i.id=?)) LIMIT 1`,
    )
    .bind(CERTIFICATE_EVENT.id, lookup, lookup, lookup)
    .first<{ id: string; current_issuance_id: string }>();
  if (!entitlement) return null;
  const rows = await db
    .prepare(
      "SELECT * FROM certificate_issuances WHERE certificate_id=? ORDER BY created_at DESC,id",
    )
    .bind(entitlement.id)
    .all<Issuance>();
  return {
    id: entitlement.id,
    currentId: entitlement.current_issuance_id,
    history: rows.results.map((row) => ({
      ...publicIssuance(row),
      createdAt: row.created_at,
      createdBy: row.created_by,
      replacementReason: row.reason,
      supersedesId: row.supersedes_id,
      revokedBy: row.revoked_by,
      revokedAt: row.revoked_at,
      reason: row.revocation_reason,
    })),
  };
}
export async function revokeCertificate(
  env: CertificateEnv,
  id: string,
  actor: string,
  reason: string,
) {
  const row = await database(env)
    .prepare(
      `UPDATE certificate_issuances SET revoked_at=?,revoked_by=?,revocation_reason=?,lease_owner=NULL,lease_until=NULL
    WHERE id=? AND revoked_at IS NULL RETURNING id`,
    )
    .bind(Math.floor(Date.now() / 1000), actor, reason, id)
    .first();
  if (!row)
    error(409, "ไม่พบเกียรติบัตรที่ยังไม่ถูกเพิกถอน กรุณาค้นหาอีกครั้ง");
}
export async function replaceCertificate(
  env: CertificateEnv,
  previousId: string,
  actor: string,
  reason: string,
  input: Confirmation,
) {
  const db = database(env);
  const old = await db
    .prepare(
      "SELECT i.* FROM certificate_issuances i JOIN certificates c ON c.current_issuance_id=i.id WHERE i.id=?",
    )
    .bind(previousId)
    .first<Issuance>();
  if (!old) error(409, "ข้อมูลเปลี่ยนแปลง กรุณาค้นหาอีกครั้ง");
  const candidate = await newIssuance(
    env,
    input,
    old.certificate_id,
    JSON.parse(old.event_snapshot),
  );
  const results = await db.batch(
    replacementStatements(db, old, actor, reason, candidate),
  );
  if (!results[0].meta.changes)
    error(409, "ข้อมูลเปลี่ยนแปลง กรุณาค้นหาอีกครั้ง");
}
