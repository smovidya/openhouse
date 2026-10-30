import type { BoothStats } from "./types";

// Compare complete normalized aliases, so Chem never also matches Biochem/Chemtech.
const aliases: Record<string, string[]> = {
  "imaging-printing": [
    "inprint",
    "imprint",
    "imaging and printing",
    "เทคโนโลยีทางภาพและการพิมพ์",
  ],
  "chemical-technology": [
    "chemtech",
    "chemthch",
    "chemical technology",
    "เคมีเทคนิค",
  ],
  bistech: ["bistech", "วิทยาศาสตร์และเทคโนโลยีอุตสาหการ"],
  bbtech: ["bbtech", "biotechnology", "เทคโนโลยีชีวภาพ"],
  bsac: ["bsac", "applied chemistry", "เคมีประยุกต์"],
  "materials-science": ["matsci", "material science", "วัสดุศาสตร์"],
  "food-technology": ["foodtech", "food science", "เทคโนโลยีทางอาหาร"],
  microbiology: ["micro", "จุลชีววิทยา"],
  botany: ["botgen", "พฤกษศาสตร์"],
  geology: ["geo", "ธรณีวิทยา"],
  "marine-science": ["marine", "วิทยาศาสตร์ทางทะเล"],
  "environmental-science": ["envi", "environment", "วิทยาศาสตร์สิ่งแวดล้อม"],
  biochemistry: ["biochem", "ชีวเคมี"],
  biology: ["biozoo", "ชีววิทยา"],
  "math-cs": [
    "mathcom",
    "mathcomsci",
    "math and computer science",
    "คณิตศาสตร์และวิทยาการคอมพิวเตอร์",
  ],
  chemistry: ["chem", "เคมี"],
  physics: ["ฟิสิกส์"],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/^(?:booth\b|บูธ|ภาควิชา)\s*/i, "")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");

export function matchesMapBooth(
  checkpoint: BoothStats,
  location: { name: string; department: string },
) {
  if (checkpoint.type !== "booth") return false;
  // A recognized department takes precedence over a potentially outdated display name.
  const department =
    checkpoint.department &&
    Object.entries(aliases).find(([slug, values]) =>
      [slug, ...values].some(
        (value) => normalize(value) === normalize(checkpoint.department!),
      ),
    )?.[0];
  if (department) return department === location.department;
  const names = [
    location.name,
    location.department,
    ...(aliases[location.department] ?? []),
  ].map(normalize);
  return [checkpoint.department, checkpoint.name].some(
    (value) => value !== null && names.includes(normalize(value)),
  );
}
