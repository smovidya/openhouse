export const souvenirTiers = [
  {
    id: "basic",
    title: "ระดับพื้นฐาน",
    prize: "สมุดและกระเป๋า",
    condition: "ลงทะเบียนเข้างาน",
    booths: 0,
    workshops: 0,
    stage: 0,
  },
  {
    id: "tier3",
    title: "รางวัลระดับที่ 3",
    prize: "หมอนเสืออ้วน",
    condition: "TCAS + กิจกรรมกลาง + บูธภาควิชา 6 บูธ",
    booths: 6,
    workshops: 0,
    stage: 0,
  },
  {
    id: "tier2",
    title: "รางวัลระดับที่ 2",
    prize: "หมวกแก๊ป",
    condition: "TCAS + กิจกรรมกลาง + บูธภาควิชา 12 บูธ + เวิร์คช็อป 1 กิจกรรม",
    booths: 12,
    workshops: 1,
    stage: 0,
  },
  {
    id: "tier1",
    title: "รางวัลระดับที่ 1",
    prize: "กระบอกน้ำเก็บความเย็น",
    condition:
      "TCAS + กิจกรรมกลาง + บูธภาควิชา 17 บูธ + เวิร์คช็อป 2 กิจกรรม + หน้าเวที 1 กิจกรรม",
    booths: 17,
    workshops: 2,
    stage: 1,
  },
] as const;

export type SouvenirTierId = (typeof souvenirTiers)[number]["id"];
export interface SouvenirStats {
  tiers: { id: SouvenirTierId; eligible: number; redeemed: number | null }[];
  unmappedCheckpoints: string[];
  unmappedRedemptions: number;
  updatedAt: string;
}

// Exact, unambiguous names only. Unrecognized checkpoint names remain visible
// as unmapped instead of silently attributing their redemptions to a tier.
export function souvenirTierForCheckpoint(
  name: string | null,
): SouvenirTierId | null {
  const normalized = name?.toLowerCase().replace(/[\s_-]/g, "");
  for (const tier of souvenirTiers) {
    if (
      [tier.id, tier.title, tier.prize].some(
        (value) => value.toLowerCase().replace(/[\s_-]/g, "") === normalized,
      )
    )
      return tier.id;
  }
  return null;
}
