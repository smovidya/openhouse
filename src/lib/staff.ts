import calendarCheckIcon from "#lib/assets/icons/calendar-check.svg";
import giftIcon from "#lib/assets/icons/gift-brown.svg";
import labPanelIcon from "#lib/assets/icons/lab-panel-brown.svg";
import storefrontIcon from "#lib/assets/icons/storefront.svg";
import {
  hasPermission,
  type StaffPermission,
} from "#lib/features/staff/permissions.ts";
import { httpStatus } from "#lib/utils.ts";

export type StaffRole = "central" | "booth";

export type StaffAction = {
  href: string;
  label: string;
  icon: string;
  permission: StaffPermission;
};

/** Per-role staff menu. "ดูข้อมูลผู้เข้าร่วมงาน" is shared and rendered by the page. */
export const staffMenus: Record<
  StaffRole,
  { title: string; actions: StaffAction[] }
> = {
  central: {
    title: "ส่วนกลาง",
    actions: [
      {
        href: "/staff/check-in",
        label: "เช็คอินเข้างาน",
        icon: calendarCheckIcon,
        permission: "activityStaff",
      },
      {
        href: "/staff/workshop-check-in",
        label: "เช็คอินเวิร์คช็อป",
        icon: labPanelIcon,
        permission: "workshopStaff",
      },
      {
        href: "/staff/rewards",
        label: "เช็คแลกของที่ระลึก",
        icon: giftIcon,
        permission: "activityStaff",
      },
    ],
  },
  booth: {
    title: "บูธนิทรรศการ",
    actions: [
      {
        href: "/staff/booth-check-in",
        label: "เช็คอินบูธนิทรรศการ",
        icon: storefrontIcon,
        permission: "boothStaff:all",
      },
    ],
  },
};

/** Menu visibility follows the same grants as the backend. */
export function getStaffActions(permissions: readonly StaffPermission[]) {
  return Object.values(staffMenus)
    .flatMap((menu) => menu.actions)
    .filter(
      (action) =>
        hasPermission(permissions, action.permission) ||
        (action.permission === "boothStaff:all" &&
          permissions.some((permission) =>
            permission.startsWith("boothStaff:"),
          )),
    );
}

/** Thai message for a failed enrollStaff / redeemInviteCode call (the server's HTTP status). */
export function inviteCodeError(error: unknown) {
  const status = httpStatus(error);
  // 400 also covers a code too short to be valid (input validation).
  if (status === 400) return "รหัสเชิญไม่ถูกต้อง หรือถูกปิดใช้งานแล้ว";
  if (status === 401) return "กรุณาเข้าสู่ระบบอีกครั้ง";
  if (status === 403) return "ใช้รหัสเชิญนี้กับบัญชีนี้ไม่ได้";
  return "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง";
}
