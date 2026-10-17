import { error } from "@sveltejs/kit";
import { placeholderBookedIds, placeholderWorkshops } from "#lib/workshops.js";
import type { PageLoad } from "./$types";

// TODO: placeholder data until the backend exists.
export const load: PageLoad = ({ params }) => {
	const workshop = placeholderWorkshops.find((w) => w.id === params.id);
	if (!workshop) error(404, "ไม่พบเวิร์คช็อป");

	return {
		waterOverlay: 0.5,
		workshop,
		// The attendee's sessions across all workshops, for clash detection.
		booked: placeholderWorkshops
			.flatMap((w) => w.sessions)
			.filter((session) => placeholderBookedIds.includes(session.id)),
	};
};
