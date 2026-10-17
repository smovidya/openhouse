import { workshops } from "#lib/workshops.js";
import type { PageLoad } from "./$types";

// TODO: placeholder data until the backend exists.
export const load: PageLoad = () => ({
  waterOverlay: 0.5,
  workshops,
});
