import { error } from "@sveltejs/kit";

// Dev-only page.
export const load = () => {
	if (!import.meta.env.DEV) error(404);
};
