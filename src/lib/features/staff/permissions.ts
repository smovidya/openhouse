import { z } from "zod";

export const departmentId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const staffPermission = z.union([
  z.enum(["admin", "boothStaff:all", "workshopStaff", "activityStaff"]),
  z.templateLiteral(["boothStaff:", departmentId]),
]);
export type StaffPermission = z.infer<typeof staffPermission>;

// These event booths have no department. Grant them separately from department booths.
export const specialBoothScopes = [
  { type: "tcas", permission: "boothStaff:tcas", label: "TCAS" },
  {
    type: "central_activity",
    permission: "boothStaff:central-activity",
    label: "กิจกรรมส่วนกลาง",
  },
] as const;

export const staffPermissions = z
  .array(staffPermission)
  .transform((values) => [...new Set(values)]);

// Shared with the UI for visibility; server operations must still enforce access.
export function hasPermission(
  granted: readonly StaffPermission[],
  required: StaffPermission,
) {
  return (
    granted.includes("admin") ||
    granted.includes(required) ||
    (granted.includes("activityStaff") &&
      (required === "workshopStaff" ||
        required === "boothStaff:all" ||
        required.startsWith("boothStaff:"))) ||
    (required.startsWith("boothStaff:") && granted.includes("boothStaff:all"))
  );
}

export interface CheckpointAccess {
  type:
    | "entry"
    | "booth"
    | "tcas"
    | "central_activity"
    | "reward"
    | "stage"
    | "workshop";
  department: string | null;
}

export function canScanCheckpoint(
  granted: readonly StaffPermission[],
  checkpoint: CheckpointAccess,
) {
  if (granted.includes("admin")) return true;
  const specialBooth = specialBoothScopes.find(
    (scope) => scope.type === checkpoint.type,
  );
  if (specialBooth) return hasPermission(granted, specialBooth.permission);
  if (checkpoint.type === "booth") {
    return (
      checkpoint.department !== null &&
      hasPermission(granted, `boothStaff:${checkpoint.department}`)
    );
  }
  if (checkpoint.type === "workshop")
    return hasPermission(granted, "workshopStaff");
  return (
    ["entry", "stage", "reward", "tcas", "central_activity"].includes(
      checkpoint.type,
    ) && hasPermission(granted, "activityStaff")
  );
}
