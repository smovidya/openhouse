import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildSeedAdminStatements, seedAdminInput } from "./seed-admin-sql";

const { values } = parseArgs({
  args: process.argv
    .slice(2)
    .filter((arg, index) => !(index === 0 && arg === "--")),
  options: {
    "user-id": { type: "string" },
    name: { type: "string" },
    phone: { type: "string" },
    type: { type: "string", default: "organizer" },
    department: { type: "string" },
    remote: { type: "boolean", default: false },
    env: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(
    'bun run staff:seed-admin --user-id USER_ID --name "Name" --phone PHONE [--type organizer] [--department physics] [--remote --env production]',
  );
} else {
  if (values.remote !== Boolean(values.env)) {
    throw new Error("Use --remote and --env together; omit both for local D1");
  }
  const input = seedAdminInput.parse({
    userId: values["user-id"],
    name: values.name,
    phone: values.phone,
    type: values.type,
    department: values.department ?? null,
  });
  const directory = await mkdtemp(join(tmpdir(), "openhouse-admin-seed-"));
  try {
    const file = join(directory, "seed.sql");
    await writeFile(file, buildSeedAdminStatements(input).join(";\n") + ";\n", {
      mode: 0o600,
    });
    const result = spawnSync(
      "bun",
      [
        "x",
        "--no-install",
        "wrangler",
        "d1",
        "execute",
        "DB",
        "--file",
        file,
        "--json",
        "--yes",
        ...(values.remote ? ["--remote", "--env", values.env!] : ["--local"]),
      ],
      { encoding: "utf8" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(result.stderr || result.stdout || "Admin seed failed");
    const responses = JSON.parse(result.stdout) as Array<{
      results?: Array<{ user_id?: string }>;
    }>;
    if (
      !responses.some((response) =>
        response.results?.some((row) => row.user_id === input.userId),
      )
    ) {
      throw new Error(
        "No admin granted: sign in first, use an active account, and ensure no other admin exists",
      );
    }
    console.log(
      `Admin access ready for user ${input.userId} (${values.remote ? values.env : "local D1"}).`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
