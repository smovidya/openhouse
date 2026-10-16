import type { AuthSession, AuthUser } from "#lib/features/auth/schemas.ts";

declare global {
  namespace App {
    interface PageData {
      session: AuthSession | null;
    }

    interface Locals {
      user: AuthUser | null;
      session: AuthSession | null;
    }
  }
}

export {};
