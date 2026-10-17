/** Room size groups from the schedule; up to one workshop per room at a time. */
export type WorkshopRoom = "M1" | "M2" | "L1" | "L2";

export type WorkshopSession = {
  id: string;
  /** ISO 8601 with offset, e.g. 2026-10-31T13:00:00+07:00 */
  start: string;
  end: string;
  room: WorkshopRoom;
  registered: number;
  capacity: number;
};

export type Workshop = {
  id: string;
  title: string;
  hostDepartment: string;
  /** As written on the schedule, e.g. "FOODTECH"; shown on the cards. */
  hostDepartmentAbbr: string;
  /** Not on the schedule yet; empty hides it. */
  description: string;
  capacity: number;
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

/** Sessions grouped by Bangkok calendar day (YYYY-MM-DD), in order. */
export function sessionsByDay(sessions: WorkshopSession[]) {
  const days = new Map<string, WorkshopSession[]>();
  for (const session of sessions) {
    const day = session.start.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), session]);
  }
  return [...days].map(([day, sessions]) => ({ day, sessions }));
}

// Source: "[OPH2027] อัปเดตตาราง Workshop.pdf" (organizers' schedule). Every session is one hour.
// TODO: move into D1 (workshops / workshop_time_slots) once the backend reads from it.
const DAYS = { sat: "2026-10-31", sun: "2026-11-01" } as const;

type Slot = [day: keyof typeof DAYS, start: string, room: WorkshopRoom];

function workshop(
  id: string,
  title: string,
  hostDepartmentAbbr: string,
  hostDepartment: string,
  capacity: number,
  slots: Slot[],
): Workshop {
  return {
    id,
    title,
    hostDepartment,
    hostDepartmentAbbr,
    description: "",
    capacity,
    sessions: slots.map(([day, start, room]) => {
      const [hour, minute] = start.split(":");
      const end = `${String(Number(hour) + 1).padStart(2, "0")}:${minute}`;
      return {
        id: `${id}-${day}-${hour}${minute}`,
        start: `${DAYS[day]}T${start}:00+07:00`,
        end: `${DAYS[day]}T${end}:00+07:00`,
        room,
        // TODO: live counts from workshop_registrations.
        registered: 0,
        capacity,
      };
    }),
  };
}

export const workshops: Workshop[] = [
  workshop("perfume", "น้ำหอม", "BSAC & Chem", "เคมีประยุกต์ และเคมี", 15, [
    ["sat", "13:00", "M1"],
    ["sat", "16:45", "M1"],
    ["sun", "09:00", "M1"],
    ["sun", "12:45", "M1"],
  ]),
  workshop(
    "cookie-leavening",
    "อบคุ้กกี้ เทียบความแตกต่างของผงฟู และ baking soda",
    "FOODTECH",
    "เทคโนโลยีทางอาหาร",
    10,
    [
      ["sat", "13:00", "M2"],
      ["sat", "14:15", "M2"],
      ["sat", "15:30", "M2"],
      ["sat", "16:45", "M2"],
      ["sun", "09:00", "M2"],
      ["sun", "10:15", "M2"],
      ["sun", "11:30", "M2"],
      ["sun", "12:45", "M2"],
    ],
  ),
  workshop("geologic-map", "ทำแผนที่ธรณีวิทยา", "GEO", "ธรณีวิทยา", 20, [
    ["sat", "13:00", "L1"],
    ["sat", "14:15", "L1"],
    ["sat", "15:30", "L1"],
    ["sat", "16:45", "L1"],
    ["sun", "09:00", "L1"],
    ["sun", "11:30", "L1"],
    ["sun", "14:00", "L1"],
    ["sun", "15:15", "L1"],
  ]),
  workshop(
    "matsci-beads",
    "เม็ดบีทรีดร้อนผจญภัยแสนสนุก",
    "MATSCI",
    "วัสดุศาสตร์",
    20,
    [
      ["sat", "13:00", "L2"],
      ["sat", "15:30", "L2"],
      ["sun", "09:00", "L2"],
      ["sun", "11:30", "L2"],
    ],
  ),
  workshop(
    "codon-code",
    "กำไล/พวงกุญแจ codon code",
    "BBTech",
    "เทคโนโลยีชีวภาพ (นานาชาติ)",
    15,
    [
      ["sat", "14:15", "M1"],
      ["sat", "18:00", "M1"],
      ["sun", "10:15", "M1"],
      ["sun", "14:00", "M1"],
    ],
  ),
  workshop(
    "stress-ball",
    "ลูกบอลคลายเครียด (stress ball) & กระดาษหด (shrink plastic)",
    "BISTECH",
    "Industrial Science and Technology (International Program)",
    20,
    [
      ["sat", "14:15", "L2"],
      ["sat", "18:00", "L2"],
      ["sun", "10:15", "L2"],
      ["sun", "12:45", "L2"],
    ],
  ),
  workshop("dna-extraction", "สกัด DNA", "BIOCHEM", "ชีวเคมี", 15, [
    ["sat", "15:30", "M1"],
    ["sun", "11:30", "M1"],
  ]),
  // The schedule spells it "Muncell".
  workshop(
    "munsell-hue-test",
    "Munsell 100 Hue Test",
    "Imprint",
    "เทคโนโลยีทางภาพและการพิมพ์",
    15,
    [
      ["sat", "16:45", "L2"],
      ["sun", "14:00", "M2"],
    ],
  ),
  workshop("streak-plate", "Streak Plate", "MICRO", "จุลชีววิทยา", 15, [
    ["sun", "10:15", "L1"],
    ["sun", "12:45", "L1"],
    ["sun", "14:00", "L2"],
    ["sun", "15:15", "L2"],
  ]),
];

/** Session ids the signed-in attendee booked. TODO: from workshop_registrations. */
export const placeholderBookedIds: string[] = [];
