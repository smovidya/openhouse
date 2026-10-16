import type { AuthSession, AuthUser } from "#lib/features/auth/schemas.ts";

declare global {
  namespace App {
    interface Platform {
      env: Env;
      cf: CfProperties;
      ctx: ExecutionContext;
    }

    interface PageData {
      session: AuthSession | null;
      /** Sky tint over the water background (root layout); defaults to 0.85. */
      waterOverlay?: number;
      waterTint?: "sky" | "navy";
    }

    interface Locals {
      user: AuthUser | null;
      session: AuthSession | null;
    }
  }
}

export { };
