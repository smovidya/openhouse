export const tierRequirements = [
  { tier: 1, departments: 17, workshops: 2, stage: true },
  { tier: 2, departments: 12, workshops: 1, stage: false },
  { tier: 3, departments: 6, workshops: 0, stage: false },
] as const;

export type RewardTier = (typeof tierRequirements)[number]["tier"];

export interface ProgressCounts {
  departmentCount: number;
  workshopCount: number;
  hasTcas: boolean;
  hasCentralActivity: boolean;
  hasStage: boolean;
}

export function evaluateProgress(counts: ProgressCounts) {
  const requirements = tierRequirements.map((rule) => {
    const missing = {
      tcas: !counts.hasTcas,
      centralActivity: !counts.hasCentralActivity,
      departments: Math.max(0, rule.departments - counts.departmentCount),
      workshops: Math.max(0, rule.workshops - counts.workshopCount),
      stage: rule.stage && !counts.hasStage,
    };
    return {
      ...rule,
      missing,
      eligible: !Object.values(missing).some(Boolean),
    };
  });
  return {
    highestEligibleTier:
      requirements.find((rule) => rule.eligible)?.tier ?? null,
    requirements,
  };
}
