import calendarCheckIcon from "#lib/assets/icons/calendar-check.svg";
import giftIcon from "#lib/assets/icons/gift-brown.svg";
import labPanelIcon from "#lib/assets/icons/lab-panel-brown.svg";
import storefrontIcon from "#lib/assets/icons/storefront.svg";

export type StaffRole = "central" | "booth";

export type StaffAction = { href: string; label: string; icon: string };

/** Per-role staff menu. "ดูข้อมูลผู้เข้าร่วมงาน" is shared and rendered by the page. */
// TODO: none of these staff pages exist yet.
export const staffMenus: Record<StaffRole, { title: string; actions: StaffAction[] }> = {
	central: {
		title: "ส่วนกลาง",
		actions: [
			{ href: "/staff/check-in", label: "เช็คอินเข้างาน", icon: calendarCheckIcon },
			{ href: "/staff/workshop-check-in", label: "เช็คอินเวิร์คช็อป", icon: labPanelIcon },
			{ href: "/staff/rewards", label: "เช็คแลกของที่ระลึก", icon: giftIcon },
		],
	},
	booth: {
		title: "บูธนิทรรศการ",
		actions: [{ href: "/staff/booth-check-in", label: "เช็คอินบูธนิทรรศการ", icon: storefrontIcon }],
	},
};
