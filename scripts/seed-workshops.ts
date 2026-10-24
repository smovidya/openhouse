import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { workshopCatalog } from "../src/lib/data/workshops";

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Update by slug and round, preserving IDs referenced by registrations. */
export function buildWorkshopSeedStatements() {
  const now = Math.floor(Date.now() / 1000);
  return workshopCatalog.flatMap((workshop) => {
    const slug = literal(workshop.slug);
    const capacity = workshop.capacity;
    return [
      `INSERT INTO workshops (id, slug, title, host_department, host_department_abbr, description, capacity, created_at, updated_at)
       VALUES (${literal(`workshop-${workshop.slug}`)}, ${slug}, ${literal(workshop.title)}, ${literal(workshop.hostDepartment)}, ${literal(workshop.hostDepartmentAbbr)}, ${literal(workshop.description)}, ${capacity}, ${now}, ${now})
       ON CONFLICT (slug) DO UPDATE SET title = excluded.title,
         host_department = excluded.host_department, host_department_abbr = excluded.host_department_abbr,
         description = excluded.description, capacity = excluded.capacity, updated_at = excluded.updated_at`,
      ...workshop.sessions.flatMap((session, index) => {
        const round = index + 1;
        const start = Date.parse(session.start) / 1000;
        const end = Date.parse(session.end) / 1000;
        const slotId = `workshop-${workshop.slug}-${round}`;
        return [
          `INSERT INTO workshop_time_slots (id, workshop_id, round_number, starts_at, ends_at, created_at, updated_at)
            SELECT ${literal(slotId)}, id, ${round}, ${start}, ${end}, ${now}, ${now}
            FROM workshops WHERE slug = ${slug}
            ON CONFLICT (workshop_id, round_number) DO UPDATE SET starts_at = excluded.starts_at,
              ends_at = excluded.ends_at, updated_at = excluded.updated_at`,
          `INSERT INTO checkpoints (id, name, type, workshop_time_slot_id, created_at, updated_at)
            SELECT ${literal(`checkpoint-${slotId}`)}, ${literal(`${workshop.title} รอบ ${round}`)}, 'workshop', workshop_time_slots.id, ${now}, ${now}
            FROM workshop_time_slots
            INNER JOIN workshops ON workshops.id = workshop_time_slots.workshop_id
            WHERE workshops.slug = ${slug} AND workshop_time_slots.round_number = ${round}
            ON CONFLICT (workshop_time_slot_id) WHERE deleted_at IS NULL AND workshop_time_slot_id IS NOT NULL
              DO UPDATE SET name = excluded.name, type = excluded.type, updated_at = excluded.updated_at
            ON CONFLICT (id) DO UPDATE SET name = excluded.name, type = excluded.type,
              workshop_time_slot_id = excluded.workshop_time_slot_id, updated_at = excluded.updated_at`,
        ];
      }),
    ];
  });
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
    console.log("bun run workshops:seed [--remote --env production]");
    return;
  }
  if (values.remote !== Boolean(values.env)) {
    throw new Error("Use --remote and --env together; omit both for local D1");
  }
  const statements = buildWorkshopSeedStatements();
  const directory = await mkdtemp(join(tmpdir(), "openhouse-workshop-seed-"));
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
      throw new Error(result.stderr || result.stdout || "Workshop seed failed");
    console.log(
      `Updated 9 workshops and 40 rounds (${values.remote ? values.env : "local D1"}).`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
