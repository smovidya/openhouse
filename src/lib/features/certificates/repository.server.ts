import type { NameSnapshot } from "./shared";
export type CertificateDatabase = Pick<D1Database, "prepare" | "batch">;
export type Issuance = {
  id: string;
  certificate_id: string;
  title: string;
  first_name: string;
  last_name: string;
  display_name: string;
  school: string;
  event_snapshot: string;
  token: string;
  template_version: string;
  created_at: number;
  created_by: string | null;
  reason: string | null;
  supersedes_id: string | null;
  pdf_key: string | null;
  render_state: "pending" | "generating" | "ready" | "failed";
  lease_owner: string | null;
  lease_until: number | null;
  revoked_at: number | null;
  revoked_by: string | null;
  revocation_reason: string | null;
};
export const snapshotName = (row: Issuance): NameSnapshot => ({
  school: row.school,
  title: row.title,
  firstName: row.first_name,
  lastName: row.last_name,
  displayName: row.display_name,
});
export const eligibilitySql = `a.deleted_at IS NULL
 AND EXISTS (SELECT 1 FROM checkpoint_logs l JOIN checkpoints p ON p.id=l.checkpoint_id
 WHERE l.attendee_id=a.id AND p.type='entry' AND p.deleted_at IS NULL AND l.deleted_at IS NULL)
 AND EXISTS (SELECT 1 FROM survey_responses s WHERE s.attendee_id=a.id AND s.deleted_at IS NULL)`;
export const currentIssuanceSql = `SELECT i.* FROM certificates c JOIN certificate_issuances i ON i.id=c.current_issuance_id
 JOIN attendees a ON a.id=c.attendee_id WHERE a.user_id=? AND c.event_id=?`;
export function currentIssuance(
  db: CertificateDatabase,
  userId: string,
  eventId: string,
) {
  return db.prepare(currentIssuanceSql).bind(userId, eventId).first<Issuance>();
}
export type NewIssuance = {
  id: string;
  certificateId: string;
  name: NameSnapshot;
  event: string;
  token: string;
  template: string;
  now: number;
};
function values(input: NewIssuance) {
  return [
    input.id,
    input.name.title,
    input.name.firstName,
    input.name.lastName,
    input.name.displayName,
    input.name.school,
    input.event,
    input.token,
    input.template,
    input.now,
  ];
}
// Conditional INSERT ... SELECT and the winner-only subsequent writes execute in one D1 batch transaction.
export function issueStatements(
  db: CertificateDatabase,
  userId: string,
  eventId: string,
  input: NewIssuance,
) {
  return [
    db
      .prepare(
        `INSERT INTO certificates (id,attendee_id,event_id,created_at)
      SELECT ?, a.id, ?, ? FROM attendees a WHERE a.user_id=? AND ${eligibilitySql}
      ORDER BY a.created_at DESC LIMIT 1 ON CONFLICT(attendee_id,event_id) DO NOTHING`,
      )
      .bind(input.certificateId, eventId, input.now, userId),
    db
      .prepare(
        `INSERT INTO certificate_issuances
      (id,title,first_name,last_name,display_name,school,event_snapshot,token,template_version,created_at,certificate_id)
      SELECT ?,?,?,?,?,?,?,?,?,?,c.id FROM certificates c WHERE c.id=? AND c.current_issuance_id IS NULL`,
      )
      .bind(...values(input), input.certificateId),
    db
      .prepare(
        `UPDATE certificates SET current_issuance_id=? WHERE id=? AND current_issuance_id IS NULL
      AND EXISTS (SELECT 1 FROM certificate_issuances WHERE id=?)`,
      )
      .bind(input.id, input.certificateId, input.id),
  ];
}
export function replacementStatements(
  db: CertificateDatabase,
  previous: Issuance,
  actor: string,
  reason: string,
  input: NewIssuance,
) {
  return [
    db
      .prepare(
        `INSERT INTO certificate_issuances
      (id,title,first_name,last_name,display_name,school,event_snapshot,token,template_version,created_at,certificate_id,created_by,reason,supersedes_id)
      SELECT ?,?,?,?,?,?,?,?,?,?,c.id,?,?,? FROM certificates c
      WHERE c.id=? AND c.current_issuance_id=?`,
      )
      .bind(
        ...values(input),
        actor,
        reason,
        previous.id,
        previous.certificate_id,
        previous.id,
      ),
    db
      .prepare(
        `UPDATE certificate_issuances SET revoked_at=?,revoked_by=?,revocation_reason=?,lease_owner=NULL,lease_until=NULL
      WHERE id=? AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM certificate_issuances WHERE id=?)`,
      )
      .bind(input.now, actor, reason, previous.id, input.id),
    db
      .prepare(
        `UPDATE certificates SET current_issuance_id=? WHERE id=? AND current_issuance_id=?
      AND EXISTS (SELECT 1 FROM certificate_issuances WHERE id=?)`,
      )
      .bind(input.id, previous.certificate_id, previous.id, input.id),
  ];
}
export async function claimLease(
  db: CertificateDatabase,
  id: string,
  owner: string,
  now: number,
) {
  return db
    .prepare(
      `UPDATE certificate_issuances SET render_state='generating',lease_owner=?,lease_until=?
    WHERE id=? AND revoked_at IS NULL AND render_state!='ready'
    AND (lease_until IS NULL OR lease_until<=?)
    AND EXISTS (SELECT 1 FROM certificates WHERE current_issuance_id=?) RETURNING *`,
    )
    .bind(owner, now + 90, id, now, id)
    .first<Issuance>();
}
export async function completeLease(
  db: CertificateDatabase,
  id: string,
  owner: string,
  key: string,
  now: number,
) {
  return db
    .prepare(
      `UPDATE certificate_issuances SET render_state='ready',pdf_key=?,lease_owner=NULL,lease_until=NULL
    WHERE id=? AND lease_owner=? AND lease_until>? AND revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM certificates WHERE current_issuance_id=?) RETURNING id`,
    )
    .bind(key, id, owner, now, id)
    .first();
}
