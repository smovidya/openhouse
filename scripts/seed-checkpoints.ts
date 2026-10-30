import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { majorOptions } from "../src/lib/registration/options";
import { workshopCatalog } from "../src/lib/data/workshops";
import { souvenirTiers } from "../src/lib/features/dashboard/souvenirs";
import {
  specialBoothScopes,
  type CheckpointAccess,
} from "../src/lib/features/staff/permissions";

const boothNames: Record<string, string> = {
  "math-cs": "Mathcom",
  chemistry: "Chem",
  physics: "Physics",
  biology: "Biozoo",
  botany: "Botgen",
  "chemical-technology": "Chemtech",
  "environmental-science": "Envi",
  "materials-science": "Matsci",
  microbiology: "Micro",
  "marine-science": "Marine",
  "food-technology": "Foodtech",
  geology: "Geo",
  biochemistry: "Biochem",
  "imaging-printing": "Inprint",
  bbtech: "BBTech",
  bsac: "Bsac",
  bistech: "Bistech",
};

type SeedCheckpoint = CheckpointAccess & {
  id: string;
  name: string;
  note: string | null;
  aliases: string[];
};

export const checkpointCatalog: SeedCheckpoint[] = [
  ...majorOptions.map(({ value, label }) => ({
    id: `checkpoint-booth-${value}`,
    type: "booth" as const,
    department: value,
    name: boothNames[value] ?? label,
    note: label,
    aliases: [value, label, boothNames[value] ?? label],
  })),
  ...specialBoothScopes.map((scope) => ({
    id: `checkpoint-${scope.type}`,
    type: scope.type,
    department: null,
    name: scope.label,
    note: null,
    aliases: [scope.label],
  })),
  {
    id: "checkpoint-entry",
    type: "entry",
    department: null,
    name: "ลงทะเบียนเข้างาน",
    note: null,
    aliases: [],
  },
  {
    id: "checkpoint-stage",
    type: "stage",
    department: null,
    name: "กิจกรรมหน้าเวที",
    note: null,
    aliases: [],
  },
  ...workshopCatalog.map((workshop) => ({
    id: `checkpoint-workshop-${workshop.slug}`,
    type: "workshop" as const,
    department: null,
    name: workshop.title,
    note: `workshop:${workshop.slug}`,
    aliases: [workshop.title, workshop.slug],
  })),
  ...souvenirTiers.map((tier) => ({
    id: `checkpoint-reward-${tier.id}`,
    type: "reward" as const,
    department: null,
    name: tier.title,
    note: tier.prize,
    aliases: [tier.id, tier.title, tier.prize],
  })),
];

const literal = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;

/** Fill missing event checkpoints; never replace IDs, logs, or deleted records. */
export function buildCheckpointSeedStatements() {
  const now = Math.floor(Date.now() / 1000);
  return checkpointCatalog.flatMap((checkpoint) => {
    const names = checkpoint.aliases
      .map((name) => literal(name.toLowerCase()))
      .join(", ");
    const nameMatch = names ? `lower(trim(name)) IN (${names})` : "0";
    const match =
      checkpoint.type === "booth"
        ? `(department = ${literal(checkpoint.department)} OR ((department IS NULL OR trim(department) = '') AND ${nameMatch}))`
        : checkpoint.type === "workshop" || checkpoint.type === "reward"
          ? `(${nameMatch} OR note = ${literal(checkpoint.note)})`
          : "1";
    return [
      // Repair missing department scope on a recognized existing booth, keeping
      // its ID, display name and history. Do not change a different assigned scope.
      ...(checkpoint.type === "booth"
        ? [
            `UPDATE checkpoints SET department = ${literal(checkpoint.department)}, updated_at = ${now}
        WHERE type = 'booth' AND deleted_at IS NULL AND (department IS NULL OR trim(department) = '') AND ${nameMatch}`,
          ]
        : []),
      `INSERT INTO checkpoints (id, name, note, type, department, created_at, updated_at)
        SELECT ${literal(checkpoint.id)}, ${literal(checkpoint.name)}, ${literal(checkpoint.note)}, ${literal(checkpoint.type)}, ${literal(checkpoint.department)}, ${now}, ${now}
        WHERE NOT EXISTS (SELECT 1 FROM checkpoints WHERE id = ${literal(checkpoint.id)} OR (type = ${literal(checkpoint.type)} AND ${match}))`,
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
    console.log("bun run checkpoints:seed [--remote --env production]");
    return;
  }
  if (values.remote !== Boolean(values.env))
    throw new Error("Use --remote and --env together; omit both for local D1");
  const directory = await mkdtemp(join(tmpdir(), "openhouse-checkpoint-seed-"));
  try {
    const file = join(directory, "seed.sql");
    await writeFile(file, buildCheckpointSeedStatements().join(";\n") + ";\n");
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
      throw new Error(
        result.stderr || result.stdout || "Checkpoint seed failed",
      );
    console.log(
      `Seeded ${checkpointCatalog.length} checkpoint definitions (${values.remote ? values.env : "local D1"}); existing IDs and history preserved.`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
