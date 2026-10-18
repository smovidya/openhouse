import { redirect } from "@sveltejs/kit";

// Preserve existing login links without a separate login page.
export const GET = () => redirect(303, "/#register");
