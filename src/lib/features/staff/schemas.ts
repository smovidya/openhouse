import { z } from "zod";
import { departmentId, staffPermissions } from "./permissions";

export const staffProfileInput = z.strictObject({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(32),
  // Descriptive affiliation (for example student or organizer), not a role.
  type: z.string().trim().min(1).max(80),
  department: departmentId.nullable().optional().default(null),
});

export const redeemInviteInput = z.strictObject({
  code: z.string().trim().min(8).max(128),
});
export const enrollStaffInput = staffProfileInput.extend({
  // An empty form field means the user will supply an invite later.
  code: z
    .string()
    .trim()
    .max(128)
    .refine(
      (value) => value.length === 0 || value.length >= 8,
      "Invite code must contain at least 8 characters",
    )
    .transform((value) => value || undefined)
    .optional(),
});
export type EnrollStaffInput = z.infer<typeof enrollStaffInput>;

export const createInviteInput = z.strictObject({
  // Blank creates a random code; a custom code follows the redemption rules.
  code: optionalInviteCode,
  permission: staffPermissions.refine(
    (values) => values.length > 0 && values.length <= 100,
    "Provide between 1 and 100 permissions",
  ),
});
export const disableInviteInput = z.strictObject({
  id: z.string().min(1).max(128),
});
export const listInvitesInput = z.strictObject({
  offset: z.int().nonnegative().default(0),
  limit: z.int().min(1).max(100).default(50),
});
