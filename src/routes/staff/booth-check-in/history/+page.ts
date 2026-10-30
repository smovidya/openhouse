import type { PageLoad } from "./$types";

export type BoothCheckIn = {
  id: string;
  name: string;
  age: number;
  /** The attendee's status, e.g. มัธยมศึกษาตอนปลาย. */
  level: string;
  booth: string;
  time: string;
};

export const load: PageLoad = async () => {
  // TODO(backend): no query returns a booth's check-ins yet; the page says it isn't ready.
  const checkins: BoothCheckIn[] = [];
  return { checkins };
};
