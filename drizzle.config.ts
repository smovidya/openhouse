/**
 * This file have been modified to support local D1 database for development by directly reading
 * the .sqlite file from the .wrangler folder. This is a workaround for the issue where Drizzle Kit
 * does not support D1 HTTP driver for local development.
 * @source <https://github.com/drizzle-team/drizzle-orm/discussions/1545#discussioncomment-11115682>
 */

import type { Config } from "drizzle-kit";

import fs from "fs";
import path from "path";

const getLocalD1 = () => {
  try {
    const basePath = path.resolve(
      ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
    );
    const dbFile = fs
      .readdirSync(basePath, { encoding: "utf-8" })
      .filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
      .map((f) => path.resolve(basePath, f))
      // One per D1 binding; take the most recently written if there are several.
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

    if (!dbFile) {
      throw new Error(
        `No local D1 database in ${basePath}; run \`bun run db:migrate:local\` (or \`bun run dev\`) first`,
      );
    }

    return dbFile;
  } catch (err) {
    console.log(`Error  ${err}`);
  }
};

const isProd = () => process.env.NODE_ENV === "production";

const getCredentials = () => {
  const prod = {
    driver: "d1-http",
    dbCredentials: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      databaseId: process.env.CLOUDFLARE_DATABASE_ID,
      token: process.env.CLOUDFLARE_D1_TOKEN,
    },
  };

  const dev = {
    dbCredentials: {
      url: getLocalD1(),
    },
  };
  return isProd() ? prod : dev;
};

export default {
  schema: "./src/lib/server/db/tables.ts",
  out: "./drizzle",
  dialect: "sqlite",
  ...getCredentials(),
} satisfies Config;
