import type { PageLoad } from "./$types";

export const load: PageLoad = ({ data }) => ({
  ...data,
  waterOverlay: 0.5,
});
