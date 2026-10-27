import { z } from "zod";

export const setMockTimeInput = z.strictObject({
  now: z.iso.datetime({ offset: true }),
});
