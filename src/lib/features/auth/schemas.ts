import { z } from "zod";
import type { StaffPermission } from "../staff/permissions";

export const googleSignInInput = z.strictObject({
  googleIdToken: z.string().min(1).max(16384),
});

export const devSessionInput = z.strictObject({
  profile: z.enum(["attendee", "staff"]),
});

export type DevProfile = z.infer<typeof devSessionInput>["profile"];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: "attendee" | "staff";
  staff: { id: string; permission: StaffPermission[] } | null;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
}
