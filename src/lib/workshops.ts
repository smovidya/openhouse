export type WorkshopSession = {
  id: string;
  roundNumber: number;
  /** ISO 8601 with offset, e.g. 2026-10-31T13:00:00+07:00 */
  start: string;
  end: string;
  registered: number;
  capacity: number;
};

export type Workshop = {
  id: string;
  title: string;
  department: string;
  description: string;
  sessions: WorkshopSession[];
};

export type SessionStatus = "available" | "full" | "conflict" | "registered";

/** Status of `session` for an attendee already booked into `booked` (sessions of any workshop). */
export function sessionStatus(
  session: WorkshopSession,
  booked: WorkshopSession[],
): SessionStatus {
  if (booked.some((other) => other.id === session.id)) return "registered";
  if (session.registered >= session.capacity) return "full";
  const start = Date.parse(session.start);
  const end = Date.parse(session.end);
  const overlaps = booked.some(
    (other) => Date.parse(other.start) < end && start < Date.parse(other.end),
  );
  return overlaps ? "conflict" : "available";
}

/** Map database-backed query data into the existing card model. */
export function toWorkshop(workshop: {
  slug: string;
  title: string;
  hostDepartment: string;
  hostDepartimentAbbr: string;
  description: string;
  capacity: number;
  timeSlots: {
    roundNumber: number;
    startsAt: Date;
    endsAt: Date;
    registeredCount: number;
  }[];
}): Workshop {
  return {
    id: workshop.slug,
    title: workshop.title,
    department: `${workshop.hostDepartment} (${workshop.hostDepartimentAbbr})`,
    description: workshop.description,
    sessions: workshop.timeSlots.map((slot) => ({
      id: `${workshop.slug}-${slot.roundNumber}`,
      roundNumber: slot.roundNumber,
      start: slot.startsAt.toISOString(),
      end: slot.endsAt.toISOString(),
      registered: slot.registeredCount,
      capacity: workshop.capacity,
    })),
  };
}

export function workshopErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    WORKSHOP_FULL: "รอบนี้เต็มแล้ว กรุณาเลือกรอบอื่น",
    WORKSHOP_TIME_CONFLICT:
      "เวลาชนกับเวิร์กช็อปที่ลงทะเบียนไว้ กรุณายกเลิกรอบเดิมก่อน",
    ALREADY_REGISTERED_FOR_WORKSHOP:
      "ลงทะเบียนเวิร์กช็อปนี้แล้ว กรุณายกเลิกรอบเดิมก่อนเลือกรอบใหม่",
    WORKSHOP_ADVANCE_REGISTRATION_LIMIT_REACHED:
      "ลงทะเบียนครบจำนวนที่กำหนดแล้ว กรุณายกเลิกเวิร์กช็อปเดิมก่อน",
    WORKSHOP_ALREADY_STARTED: "รอบนี้เริ่มแล้ว ไม่สามารถลงทะเบียนได้",
    WORKSHOP_REGISTRATION_NOT_OPEN: "ยังไม่เปิดลงทะเบียนเวิร์กช็อป",
    WORKSHOP_REGISTRATION_CLOSED: "หมดเวลาลงทะเบียนและยกเลิกเวิร์กช็อปแล้ว",
    WORKSHOP_TIME_SLOT_NOT_FOUND: "ไม่พบรอบเวิร์กช็อปนี้ กรุณาโหลดหน้าใหม่",
    WORKSHOP_REGISTRATION_NOT_FOUND: "ไม่พบการลงทะเบียนนี้ กรุณาลองอีกครั้ง",
  };
  return messages[code] ?? "ไม่สามารถทำรายการได้ กรุณาลองอีกครั้ง";
}
