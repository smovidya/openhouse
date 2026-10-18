import type { RegisteredWorkshop } from "#lib/components/workshop-card.svelte";
import type { RewardTier } from "#lib/components/reward-tier-card.svelte";
import type { PageLoad } from "./$types";

const conditions = [
  { label: "บูธภาควิชา", done: 1, total: 2 },
  { label: "บูธเวิร์คช็อป", done: 1, total: 2 },
  { label: "ภารกิจติดhashtag", done: 0, total: 1 },
  { label: "ภารกิจตามหาของ", done: 0, total: 1 },
];
const rewards = ["ปากกาโจรสลัด", "สมุดบันทึกการเดินทาง"];

// TODO: connect workshop bookings and reward progress to the backend.
export const load: PageLoad = ({ data }) => ({
  ...data,
  waterOverlay: 0.5,
  workshopLimit: 3,
  workshops: [] as RegisteredWorkshop[],
  rewardTiers: [
    { title: "ลูกเรือโจรสลัด", conditions, rewards },
    { title: "รองหัวหน้าโจรสลัด", conditions, rewards },
    { title: "กัปตันโจรสลัด", conditions, rewards },
  ] satisfies RewardTier[],
});
