export type WorkshopSession = {
  id: string;
  /** ISO 8601 with offset, e.g. 2026-10-31T13:00:00+07:00 */
  start: string;
  end: string;
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

// Source: "เนื้อหา Workshop [Science Chula Open House 2027]" (organizers' latest content sheet;
// it supersedes the earlier "[OPH2027] อัปเดตตาราง Workshop.pdf"). Every session is one hour.
// TODO: move into D1 (workshops / workshop_time_slots) once the backend reads from it.
const DAYS = { sat: "2026-10-31", sun: "2026-11-01" } as const;

type Slot = [day: keyof typeof DAYS, start: string];

function workshop({
  id,
  title,
  hostDepartmentAbbr,
  hostDepartment,
  description = "",
  capacity,
  slots,
}: Omit<Workshop, "sessions" | "description"> & {
  description?: string;
  slots: Slot[];
}): Workshop {
  return {
    id,
    title,
    hostDepartment,
    hostDepartmentAbbr,
    description,
    capacity,
    sessions: slots.map(([day, start]) => {
      const [hour, minute] = start.split(":");
      const end = `${String(Number(hour) + 1).padStart(2, "0")}:${minute}`;
      return {
        id: `${id}-${day}-${hour}${minute}`,
        start: `${DAYS[day]}T${start}:00+07:00`,
        end: `${DAYS[day]}T${end}:00+07:00`,
        // TODO: live counts from workshop_registrations.
        registered: 0,
        capacity,
      };
    }),
  };
}

export const workshops: Workshop[] = [
  workshop({
    id: "geologic-map",
    title: "สำรวจเกาะ เจาะแผนที่",
    hostDepartmentAbbr: "GEO",
    hostDepartment: "ธรณีวิทยา",
    description:
      "กิจกรรมสร้างแผนที่ธรณีวิทยาจากข้อมูลสำรวจ กิจกรรมนี้รับน้องทั้งหมด 20 คน โดยจะแบ่งออกเป็น 5 กลุ่ม กลุ่มละ 4 คน น้องๆ จะได้สวมบทบาทเป็นนักธรณีวิทยาตัวจิ๋ว จำลองการออกภาคสนาม โดยน้องๆ จะเวียนฐานกันไปสำรวจหรือศึกษาหินที่จัดเตรียมไว้ ใช้เวลาฐานละ 7 นาที พี่ประจำฐานจะสอนการจำแนกหินเบื้องต้น การวางตัวของชั้นหินให้กับน้องๆ และจดข้อมูลไว้ในกระดาษที่แจกให้ จากนั้นนำข้อมูลแต่ละจุดที่ได้มาจัดทำเป็นแผนที่ธรณีวิทยาอย่างง่าย",
    capacity: 20,
    slots: [
      ["sat", "13:00"],
      ["sat", "14:15"],
      ["sat", "15:30"],
      ["sat", "16:45"],
      ["sun", "09:00"],
      ["sun", "11:30"],
      ["sun", "14:00"],
      ["sun", "15:15"],
    ],
  }),
  workshop({
    id: "dna-extraction",
    title: "สกัด DNA",
    hostDepartmentAbbr: "BIOCHEM",
    hostDepartment: "ชีวเคมี",
    description:
      "กิจกรรมนี้จะพาผู้ร่วมกิจกรรมทุกคนไปเจาะลึกความลับทางพันธุกรรมที่ซ่อนอยู่ในสิ่งมีชีวิตรอบตัวเรา ด้วยขั้นตอนง่ายๆ ที่ทำได้จริงและเข้าใจง่ายโดยใช้ดีเอ็นเอจาก “มะละกอ” กิจกรรมนี้ถูกออกแบบมาเพื่อเป็นประตูบานแรกสู่โลกแห่งชีวเคมีและการค้นพบทางวิทยาศาสตร์ ด้วยการใช้เพียงอุปกรณ์ที่หาได้ในครัวเรือน เราจะชวนผู้ร่วมกิจกรรมทุกคนมาเป็นนักวิทยาศาสตร์ เพื่อเจาะลึกและสัมผัสกับดีเอ็นเออย่างใกล้ชิด",
    capacity: 15,
    slots: [
      ["sat", "15:30"],
      ["sun", "11:30"],
    ],
  }),
  workshop({
    id: "little-beads",
    title: "Little Beads, Big Ideas",
    hostDepartmentAbbr: "MATSCI",
    hostDepartment: "วัสดุศาสตร์",
    description:
      "เม็ดบีทรีดร้อน (Little Beads, Big Ideas) ใช้ลูกปัดที่เป็นวัสดุพอลิเมอร์มาจัดเรียงให้ได้พวงกุญแจตามรูปร่างที่กำหนดไว้ จากนั้นใช้ความร้อนรีดจนเม็ดลูกปัดหลอมติดกันเป็นรูปที่ต้องการ",
    capacity: 20,
    slots: [
      ["sat", "13:00"],
      ["sat", "15:30"],
      ["sun", "09:00"],
      ["sun", "11:30"],
    ],
  }),
  workshop({
    id: "mushroom-culture",
    title: "Mushroom culture",
    hostDepartmentAbbr: "MICRO",
    hostDepartment: "จุลชีววิทยา",
    description:
      "กิจกรรมที่ให้ผู้เข้าร่วมเรียนรู้กระบวนการเพาะเห็ดเบื้องต้น ผู้เข้าร่วมจะได้ศึกษาลักษณะของเห็ดและเส้นใยเห็ดพร้อมลงมือปฏิบัติผ่าเห็ดจริง",
    capacity: 15,
    slots: [
      ["sun", "10:15"],
      ["sun", "12:45"],
      ["sun", "14:00"],
      ["sun", "15:15"],
    ],
  }),
  workshop({
    id: "art-meet-sci",
    title: "Art Meet Sci",
    hostDepartmentAbbr: "IMPRINT",
    hostDepartment: "เทคโนโลยีทางภาพและการพิมพ์",
    description:
      "กิจกรรมเรียนรู้เกี่ยวกับเม็ดสีจากธรรมชาติ (Natural Pigment) และแหล่งที่มา เช่น หิน แร่ธาตุ พืช และสัตว์ ที่ถูกนำมาใช้ตั้งแต่อดีตจนถึงปัจจุบัน โดยให้น้อง ๆ เลือก Pigment ที่จัดเตรียมไว้ นำไปผสมกับเรซินตามสัดส่วน แล้วนำมา ผสมกับเม็ดสีที่ผ่านการบดละเอียด ก่อนนำสีที่ได้ไประบายลงบนภาพ เพื่อสร้างสรรค์ผลงาน ตามจินตนาการของตนเอง",
    capacity: 15,
    slots: [
      ["sat", "16:45"],
      ["sun", "14:00"],
    ],
  }),
  workshop({
    id: "behind-the-cookies",
    title: "Behide the Cookies!",
    hostDepartmentAbbr: "FOODTECH",
    hostDepartment: "เทคโนโลยีทางอาหาร",
    description:
      "กิจกรรมนี้มุ่งเน้นให้ผู้เข้าร่วมได้เรียนรู้และเข้าใจถึงความเชื่อมโยงระหว่างกระบวนการทำคุกกี้กับองค์ความรู้ด้านวิทยาศาสตร์และเทคโนโลยีการอาหาร (Food Science and Technology) อย่างเป็นระบบ ผ่านการบูรณาการ 3 สาขาวิชาหลัก ได้แก่ วิศวกรรมและการแปรรูปอาหาร (Food Processing), เคมีอาหาร (Food Chemistry) และจุลชีววิทยาอาหาร (Food Microbiology) เพื่อให้ผู้เข้าร่วมเห็นภาพว่าการอบคุกกี้ไม่ใช่เพียงการทำเบเกอรี่ แต่มียุทธศาสตร์ทางวิทยาศาสตร์แฝงอยู่ในทุกขั้นตอน",
    capacity: 10,
    slots: [
      ["sat", "13:00"],
      ["sat", "14:15"],
      ["sat", "15:30"],
      ["sat", "16:45"],
      ["sun", "09:00"],
      ["sun", "10:15"],
      ["sun", "11:30"],
      ["sun", "12:45"],
    ],
  }),
  workshop({
    id: "perfume",
    title: "Perfume",
    hostDepartmentAbbr: "BSAC & CHEM",
    hostDepartment: "หลักสูตรเคมีประยุกต์ และภาควิชาเคมี",
    description:
      "กิจกรรมนี้เปิดโอกาสให้น้อง ๆ ได้เรียนรู้เรื่อง โครงสร้างของกลิ่นในน้ำหอม (Top, Middle และ Base note) ผ่านการทดลองดมกลิ่น การทายประเภทของกลิ่น และการผสมกลิ่น เพื่อสร้างน้ำหอมสูตรของตนเอง น้อง ๆ จะได้สังเกตการเปลี่ยนแปลงของกลิ่นตามเวลา พร้อมเชื่อมโยงกับหลักการทางเคมีเรื่องการระเหยและคุณสมบัติของสาร ที่ให้กลิ่น",
    capacity: 15,
    slots: [
      ["sat", "13:00"],
      ["sat", "16:45"],
      ["sun", "09:00"],
      ["sun", "12:45"],
    ],
  }),
  workshop({
    id: "dna-bracelet",
    title: "กำไลข้อมือ DNA",
    hostDepartmentAbbr: "BBTech",
    hostDepartment: "หลักสูตรเทคโนโลยีชีวภาพ",
    description:
      "ผู้เข้าร่วมจะได้สะกดชื่อตัวเองเป็นรหัส DNA โดยใช้ลูกปัด 4 สีแทนเบส A, T, C และ G ซึ่งเบส 3 ตัวเรียงกัน (codon) จะแทนตัวอักษร 1 ตัวตามตารางรหัส (เช่น P = ATG) จากนั้นร้อยลูกปัดตามรหัสของแต่ละตัวอักษรจนครบชื่อ แล้วนำไปทำเป็นสร้อยข้อมือหรือพวงกุญแจ",
    capacity: 15,
    slots: [
      ["sat", "13:00"],
      ["sat", "18:00"],
      ["sun", "10:15"],
      ["sun", "14:00"],
    ],
  }),
  workshop({
    id: "shrink-plastic",
    title: "พวงกุญแจ shrink plastic",
    hostDepartmentAbbr: "BISTECH",
    hostDepartment: "หลักสูตรวิทยาศาสตร์และเทคโนโลยีอุตสาหการ",
    description:
      "กิจกรรมพวงกุญแจ shrink plastic เป็นการวาดรูปลงบนแผ่นพลาสติกและนำไปอบ จากแผ่นพลาสติกบางๆจะหดตัวลง ทำให้หนาและแข็งแรงขึ้น ผู้เข้าร่วมจะได้ทำพวงกุญแจ diy เป็นของตัวเองและนำกลับบ้านได้",
    capacity: 20,
    slots: [
      ["sat", "14:15"],
      ["sat", "18:00"],
      ["sun", "10:15"],
      ["sun", "12:45"],
    ],
  }),
];

/** Session ids the signed-in attendee booked. TODO: from workshop_registrations. */
export const placeholderBookedIds: string[] = [];
