import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { majorOptions } from "../src/lib/registration/options";

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Stable IDs let repeat seeds update checkpoints without replacing check-in references. */
export function buildBoothSeedStatements() {
  const now = Math.floor(Date.now() / 1000);
  const checkpoints = [
    ...majorOptions.map(({ value, label }) => ({
      id: `booth-${value}`,
      name: label,
      department: value,
      type: "booth",
    })),
    { id: "entry", name: "ลงทะเบียนเข้างาน", department: null, type: "entry" },
    { id: "tcas", name: "TCAS", department: null, type: "tcas" },
    {
      id: "central-activity",
      name: "กิจกรรมส่วนกลาง",
      department: null,
      type: "central_activity",
    },
    { id: "stage", name: "เวที", department: null, type: "stage" },
    { id: "reward", name: "แลกรางวัล", department: null, type: "reward" },
  ];
  return checkpoints.map(
    (checkpoint) =>
      `INSERT INTO checkpoints (id, name, department, type, created_at, updated_at)
       VALUES (${literal(checkpoint.id)}, ${literal(checkpoint.name)}, ${checkpoint.department === null ? "NULL" : literal(checkpoint.department)}, ${literal(checkpoint.type)}, ${now}, ${now})
       ON CONFLICT (id) DO UPDATE SET name = excluded.name,
         department = excluded.department, type = excluded.type,
         updated_at = excluded.updated_at`,
  );
}

async function main() {
  const { values } = parseArgs({
    args: process.argv
      .slice(2)
      .filter((arg, index) => !(index === 0 && arg === "--")),
    options: {
      remote: { type: "boolean", default: false },
      env: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log("bun run booths:seed [--remote --env production]");
    return;
  }
  if (values.remote !== Boolean(values.env)) {
    throw new Error("Use --remote and --env together; omit both for local D1");
  }
  const statements = buildBoothSeedStatements();
  const directory = await mkdtemp(join(tmpdir(), "openhouse-booth-seed-"));
  try {
    const file = join(directory, "seed.sql");
    await writeFile(file, statements.join(";\n") + ";\n");
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
        "--yes",
        ...(values.remote ? ["--remote", "--env", values.env!] : ["--local"]),
      ],
      { encoding: "utf8" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(result.stderr || result.stdout || "Booth seed failed");
    console.log(
      `Updated ${statements.length} checkpoints (${values.remote ? values.env : "local D1"}).`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
