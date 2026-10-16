import { z } from "zod";

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
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
}
