import type { ErrorMessage } from "#lib/error-dialog.svelte.js";

/** Why a workshop check-in was refused: the attendance API's 409 messages. */
export type RejectionCode =
  | "ENTRY_REQUIRED"
  | "ALREADY_CHECKED_IN"
  | "WORKSHOP_ALREADY_ATTENDED"
  | "ADVANCE_REGISTRATION_REQUIRED"
  | "WORKSHOP_FULL";

export const rejectionMessages = {
  ENTRY_REQUIRED: {
    title: "ยังไม่ได้ผ่านจุดลงทะเบียน",
    description:
      "ให้ผู้เข้าร่วมงานไปรับของที่ระลึกที่จุดลงทะเบียนก่อน แล้วกลับมาใหม่",
  },
  ALREADY_CHECKED_IN: {
    title: "เช็คอินแล้ว",
    description: "ผู้เข้าร่วมงานเช็คอินรอบนี้ไปแล้ว",
  },
  WORKSHOP_ALREADY_ATTENDED: {
    title: "เข้าร่วมเวิร์คช็อปนี้แล้ว",
    description: "ผู้เข้าร่วมงานเข้าร่วมเวิร์คช็อปนี้ในรอบอื่นไปแล้ว",
  },
  ADVANCE_REGISTRATION_REQUIRED: {
    title: "ไม่ได้ลงทะเบียนล่วงหน้า",
    description:
      "ผู้เข้าร่วมงานไม่ได้ลงทะเบียนเวิร์คช็อปและรอบเวลานี้ไว้ หากยังมีที่ว่าง ใช้โหมด “เพิ่มคน” แทน",
  },
  WORKSHOP_FULL: {
    title: "รอบนี้เต็มแล้ว",
    description: "ที่นั่งของรอบเวลานี้เต็มแล้ว",
  },
} as const satisfies Record<RejectionCode, ErrorMessage>;

export const isRejection = (code: string | null): code is RejectionCode =>
  code !== null && Object.hasOwn(rejectionMessages, code);
