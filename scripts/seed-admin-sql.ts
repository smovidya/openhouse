import { z } from "zod";
import { staffProfileInput } from "../src/lib/features/staff/schemas";

export const seedAdminInput = staffProfileInput.extend({
  userId: z.string().min(1).max(128),
});

// Wrangler's SQL-file interface has no parameter binding. Escape every string;
// never interpolate CLI input into a shell command or an unquoted SQL literal.
const literal = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;

export function buildSeedAdminStatements(
  input: z.infer<typeof seedAdminInput>,
) {
  const profile = seedAdminInput.parse(input);
  const userId = literal(profile.userId);
  const now = Math.floor(Date.now() / 1000);
  return [
    `INSERT INTO staffs (id, user_id, type, name, department, phone, permission, created_at, updated_at)
     SELECT ${literal(crypto.randomUUID())}, id, ${literal(profile.type)}, ${literal(profile.name)},
       ${literal(profile.department)}, ${literal(profile.phone)}, '["admin"]', ${now}, ${now}
     FROM users WHERE id = ${userId} AND deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM staffs AS s JOIN users AS u ON u.id = s.user_id
         WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM json_each(s.permission) WHERE value = 'admin')
       )
     ON CONFLICT (user_id) DO UPDATE SET
       permission = (SELECT json_group_array(value) FROM (
         SELECT value FROM json_each(staffs.permission) UNION SELECT 'admin'
       )), updated_at = ${now}
     WHERE staffs.deleted_at IS NULL`,
    // Only an active profile already granted admin can be promoted. This also
    // makes the command safe to retry if execution stopped between statements.
    `UPDATE users SET role = 'staff', updated_at = ${now}
     WHERE id = ${userId} AND deleted_at IS NULL AND EXISTS (
       SELECT 1 FROM staffs WHERE user_id = ${userId} AND deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM json_each(permission) WHERE value = 'admin')
     )`,
    `SELECT u.id AS user_id FROM users AS u JOIN staffs AS s ON s.user_id = u.id
     WHERE u.id = ${userId} AND u.role = 'staff' AND u.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM json_each(s.permission) WHERE value = 'admin')`,
  ];
}
