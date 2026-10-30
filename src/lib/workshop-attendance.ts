import type { ErrorMessage } from "#lib/error-dialog.svelte.js";

import type { CheckInWorkshopInput } from "#lib/features/workshops/schemas.ts";
import { getWorkshopBySlug } from "#lib/features/workshops/workshops.remote.ts";
import type { WorkshopSession } from "#lib/workshops.js";
import { httpErrorMessage, httpStatus } from "#lib/utils.js";

/** `advance` lets in attendees who booked the round; `open` also adds walk-ins. */
export type AttendanceMode = CheckInWorkshopInput["mode"];

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

export const slotNotFound: ErrorMessage = {
  title: "ไม่พบรอบเวลานี้ในระบบ",
  description: "รอบเวลานี้ยังไม่ได้ตั้งค่าในระบบ กรุณาติดต่อผู้ดูแลระบบ",
};

type WorkshopResult = Awaited<ReturnType<typeof getWorkshopBySlug>>;

/** A catalog round's time slot id (the attendance API's `workshopTimeSlotId`) in `getWorkshopBySlug`'s result. */
export function slotIdIn(
  result: WorkshopResult,
  session: Pick<WorkshopSession, "round">,
): string | null {
  if (result.isErr()) return null;
  return (
    result.value?.timeSlots.find((slot) => slot.roundNumber === session.round)
      ?.slotId ?? null
  );
}

/** Looks up a catalog round's time slot id; null when the round isn't in D1. */
export async function findSlotId(
  session: Pick<WorkshopSession, "workshop" | "round">,
) {
  const result = await getWorkshopBySlug(session.workshop);
  if (result.isErr()) throw new Error(result.error);
  return slotIdIn(result, session);
}

/** A failed query's `error` (App.Error) carries the code as its message. */
function errorCode(error: unknown) {
  if (httpErrorMessage(error) !== null) return httpErrorMessage(error);
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : null;
}

/** The dialog for a failed attendance call: a thrown command error or a query's `error`. */
export function attendanceError(error: unknown): ErrorMessage {
  const reason = errorCode(error);
  if (isRejection(reason)) return rejectionMessages[reason];
  if (reason === "WORKSHOP_TIME_SLOT_NOT_FOUND") return slotNotFound;
  if (httpStatus(error) === 403)
    return {
      title: "ไม่มีสิทธิ์",
      description: "บัญชีนี้ไม่มีสิทธิ์เช็คอินเวิร์คช็อป",
    };
  return {
    title: "บันทึกไม่สำเร็จ",
    description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง",
  };
}
