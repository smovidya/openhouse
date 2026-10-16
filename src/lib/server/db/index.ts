import { drizzle } from "drizzle-orm/d1";
import { relations } from "./relations";

export const getDb = (d1: D1Database) => drizzle(d1, { relations });

export type Db = ReturnType<typeof getDb>;
export { tables } from "./tables";
export { relations };
