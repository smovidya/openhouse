import { command, getRequestEvent, query } from "$app/server";
import { env } from "cloudflare:workers";
import { error, isHttpError } from "@sveltejs/kit";
import { z } from "zod";
import {
  requirePermission,
  requireSameOrigin,
  requireUser,
} from "../auth/guards.server";
import { type CertificateEnv } from "./config.server";
import { confirmationSchema } from "./shared";
import {
  confirmCertificate,
  lookupCertificate,
  myCertificate,
  prepareCertificate,
  replaceCertificate,
  revokeCertificate,
} from "./service.server";
const certificateEnv = env as CertificateEnv;
function actor(admin = false, mutation = false) {
  const event = getRequestEvent();
  // Remote queries cannot read event.url; the hook computes the trusted host gate.
  if (!event.locals.certificateOperationsAllowed) error(404, "Not found");
  if (mutation) requireSameOrigin(event);
  const user = admin
    ? requirePermission(event.locals.user, "admin")
    : requireUser(event.locals.user);
  // Account roles can predate attendee registration. The service resolves the
  // caller's own registration and enforces attendance/evaluation eligibility.
  return user;
}
async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    if (isHttpError(cause)) throw cause;
    if (cause instanceof Error && /^[ก-๛]/u.test(cause.message))
      error(400, cause.message);
    error(503, "ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองอีกครั้ง");
  }
}
export const getMyCertificate = query(async () => {
  const user = actor();
  return safe(() => myCertificate(certificateEnv, user.id));
});
export const confirmMyCertificateName = command(
  confirmationSchema,
  async (input) => {
    const user = actor(false, true);
    return safe(() => confirmCertificate(certificateEnv, user.id, input));
  },
);
export const prepareMyCertificate = command(async () => {
  const user = actor(false, true);
  return safe(() => prepareCertificate(certificateEnv, user.id));
});
export const adminLookupCertificate = query(
  z.string().trim().min(1).max(120),
  async (input) => {
    actor(true);
    return safe(() => lookupCertificate(certificateEnv, input));
  },
);
const auditSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});
export const adminRevokeCertificate = command(auditSchema, async (input) => {
  const user = actor(true, true);
  await safe(() =>
    revokeCertificate(certificateEnv, input.id, user.id, input.reason),
  );
});
export const adminReplaceCertificate = command(
  auditSchema.extend({ confirmation: confirmationSchema }),
  async (input) => {
    const user = actor(true, true);
    await safe(() =>
      replaceCertificate(
        certificateEnv,
        input.id,
        user.id,
        input.reason,
        input.confirmation,
      ),
    );
  },
);
