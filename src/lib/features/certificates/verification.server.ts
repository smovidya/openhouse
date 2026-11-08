import type { CertificateEnv } from "./config.server";
import { verifyCertificateToken } from "./token.server";
export async function verifyRecognizedCertificate(
  env: CertificateEnv,
  token: string,
) {
  let claims;
  try {
    claims = await verifyCertificateToken(env, token);
  } catch {
    return { status: "invalid" as const, claims: null };
  }
  try {
    const row = await env.DB.withSession("first-primary")
      .prepare(
        `SELECT i.token,i.revoked_at,c.current_issuance_id FROM certificate_issuances i
      JOIN certificates c ON c.id=i.certificate_id WHERE i.id=?`,
      )
      .bind(claims.jti)
      .first<{
        token: string;
        revoked_at: number | null;
        current_issuance_id: string;
      }>();
    if (!row || row.token !== token)
      return { status: "invalid" as const, claims: null };
    return {
      status:
        row.revoked_at !== null || row.current_issuance_id !== claims.jti
          ? ("revoked" as const)
          : ("valid" as const),
      claims,
    };
  } catch {
    return { status: "unavailable" as const, claims };
  }
}
