import { z } from "zod";
import type { StaffPermission } from "../staff/permissions";

export const googleSignInInput = z.strictObject({
  googleIdToken: z.string().min(1).max(16384),
});

export const devSessionInput = z.strictObject({
  // attendee: registered (has an attendee profile); newcomer: signed in but not registered yet;
  // staff: a staff member.
  profile: z.enum(["attendee", "newcomer", "staff"]),
});

export type DevProfile = z.infer<typeof devSessionInput>["profile"];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: "attendee" | "staff";
  staff: { id: string; permission: StaffPermission[] } | null;
  /** The user's attendee registration; null until they complete the registration form. */
  attendee: { id: string; qrCodeId: string } | null;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
}
