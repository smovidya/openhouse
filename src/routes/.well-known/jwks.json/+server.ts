import { env } from "cloudflare:workers";
import { json } from "@sveltejs/kit";
import {
  publicKeys,
  type CertificateEnv,
} from "#lib/features/certificates/config.server.ts";
export const GET = () =>
  json(
    { keys: publicKeys(env as CertificateEnv) },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
