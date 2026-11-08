import { env } from "cloudflare:workers";
import type { PageServerLoad } from "./$types";
import { verifyRecognizedCertificate } from "#lib/features/certificates/verification.server.ts";
export const load: PageServerLoad = ({ params }) =>
  verifyRecognizedCertificate(env, params.token);
