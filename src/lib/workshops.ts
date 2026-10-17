export type WorkshopSession = {
	id: string;
	/** ISO 8601 with offset, e.g. 2025-10-18T10:10:00+07:00 */
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
export function sessionStatus(session: WorkshopSession, booked: WorkshopSession[]): SessionStatus {
	if (booked.some((other) => other.id === session.id)) return "registered";
	if (session.registered >= session.capacity) return "full";
	const start = Date.parse(session.start);
	const end = Date.parse(session.end);
	const overlaps = booked.some(
		(other) => Date.parse(other.start) < end && start < Date.parse(other.end)
	);
	return overlaps ? "conflict" : "available";
}

// TODO: placeholder data until the backend exists.
const description =
	"กิจกรรมนี้ถูกออกแบบมาเพื่อเป็นประตูบานแรกสู่โลกแห่งชีวเคมีและการค้นพบทางวิทยาศาสตร์ กิจกรรมนี้ถูกออกแบบมาเพื่อเป็นประตูบานแรกสู่โลกแห่งชีวเคมีและการค้นพบทางวิทยาศาสตร์ ผ่านการทดลองสกัด DNA จากกล้วยด้วยอุปกรณ์ที่หาได้ในครัว";

const slots = [
	["10:10", "10:50", 2],
	["11:05", "11:40", 15],
	["13:30", "14:10", 10],
	["14:30", "15:10", 11],
] as const;

export const placeholderWorkshops: Workshop[] = [1, 2, 3].map((n) => {
	const id = `banana-dna-${n}`;
	return {
		id,
		title: "A minion mission : Banana DNA",
		department: "BBTECH & BISTECH",
		description,
		sessions: slots.map(([start, end, registered], i) => ({
			id: `${id}-${i + 1}`,
			start: `2025-10-18T${start}:00+07:00`,
			end: `2025-10-18T${end}:00+07:00`,
			registered,
			capacity: 15,
		})),
	};
});

/** Session ids the signed-in attendee booked: one per status on banana-dna-1's detail page. */
export const placeholderBookedIds = ["banana-dna-1-3", "banana-dna-2-4"];
