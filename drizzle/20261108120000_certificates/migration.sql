CREATE TABLE certificates (
  id TEXT PRIMARY KEY NOT NULL,
  attendee_id TEXT NOT NULL REFERENCES attendees(id),
  event_id TEXT NOT NULL,
  current_issuance_id TEXT REFERENCES certificate_issuances(id) DEFERRABLE INITIALLY DEFERRED,
  created_at INTEGER NOT NULL,
  UNIQUE(attendee_id, event_id)
);
CREATE TABLE certificate_issuances (
  id TEXT PRIMARY KEY NOT NULL,
  certificate_id TEXT NOT NULL REFERENCES certificates(id),
  title TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, display_name TEXT NOT NULL,
  school TEXT NOT NULL,
  event_snapshot TEXT NOT NULL, token TEXT NOT NULL UNIQUE, template_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id), reason TEXT,
  supersedes_id TEXT UNIQUE REFERENCES certificate_issuances(id),
  pdf_key TEXT, render_state TEXT NOT NULL DEFAULT 'pending' CHECK(render_state IN ('pending','generating','ready','failed')),
  lease_owner TEXT, lease_until INTEGER,
  revoked_at INTEGER, revoked_by TEXT REFERENCES users(id), revocation_reason TEXT,
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR
         (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND length(trim(revocation_reason)) > 0)),
  CHECK ((supersedes_id IS NULL AND created_by IS NULL AND reason IS NULL) OR
         (supersedes_id IS NOT NULL AND created_by IS NOT NULL AND length(trim(reason)) > 0)),
  CHECK ((render_state = 'ready' AND pdf_key IS NOT NULL) OR render_state != 'ready')
);
CREATE INDEX certificate_issuances_entitlement ON certificate_issuances(certificate_id);
CREATE TRIGGER certificate_issuances_immutable BEFORE UPDATE ON certificate_issuances
WHEN NEW.id IS NOT OLD.id OR NEW.certificate_id IS NOT OLD.certificate_id
 OR NEW.title IS NOT OLD.title OR NEW.first_name IS NOT OLD.first_name OR NEW.last_name IS NOT OLD.last_name
 OR NEW.school IS NOT OLD.school OR NEW.display_name IS NOT OLD.display_name OR NEW.event_snapshot IS NOT OLD.event_snapshot
 OR NEW.token IS NOT OLD.token OR NEW.template_version IS NOT OLD.template_version
 OR NEW.created_at IS NOT OLD.created_at OR NEW.created_by IS NOT OLD.created_by
 OR NEW.reason IS NOT OLD.reason OR NEW.supersedes_id IS NOT OLD.supersedes_id
 OR (OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS NOT OLD.revoked_at OR NEW.revoked_by IS NOT OLD.revoked_by OR NEW.revocation_reason IS NOT OLD.revocation_reason))
BEGIN SELECT RAISE(ABORT, 'immutable certificate issuance'); END;
CREATE TRIGGER certificates_permanent BEFORE DELETE ON certificates
BEGIN SELECT RAISE(ABORT, 'permanent certificate entitlement'); END;
CREATE TRIGGER certificate_issuances_permanent BEFORE DELETE ON certificate_issuances
BEGIN SELECT RAISE(ABORT, 'permanent certificate issuance'); END;
CREATE TRIGGER certificates_identity_immutable BEFORE UPDATE ON certificates
WHEN NEW.id IS NOT OLD.id OR NEW.attendee_id IS NOT OLD.attendee_id OR NEW.event_id IS NOT OLD.event_id OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'immutable certificate entitlement'); END;
CREATE TRIGGER certificates_current_valid BEFORE UPDATE OF current_issuance_id ON certificates
WHEN NEW.current_issuance_id IS NULL OR NOT EXISTS (
 SELECT 1 FROM certificate_issuances i WHERE i.id=NEW.current_issuance_id AND i.certificate_id=NEW.id
)
BEGIN SELECT RAISE(ABORT, 'invalid current issuance'); END;
