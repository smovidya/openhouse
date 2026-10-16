import type { RegisteredWorkshop } from "#lib/components/workshop-card.svelte";
import type { RewardTier } from "#lib/components/reward-tier-card.svelte";
import type { PageLoad } from "./$types";

const description =
	"กิจกรรมนี้ถูกออกแบบมาเพื่อเป็นประตูบานแรกสู่โลกแห่งชีวเคมีและการค้นพบทางวิทยาศาสตร์ กิจกรรมนี้ถูกออกแบบมาเพื่อเป็นประตูบานแรกสู่โลกแห่งชีวเคมีและการค้นพบทางวิทยาศาสตร์";

const conditions = [
	{ label: "บูธภาควิชา", done: 1, total: 2 },
	{ label: "บูธเวิร์คช็อป", done: 1, total: 2 },
	{ label: "ภารกิจติดhashtag", done: 0, total: 1 },
	{ label: "ภารกิจตามหาของ", done: 0, total: 1 },
];
const rewards = ["ปากกาโจรสลัด", "สมุดบันทึกการเดินทาง"];

// TODO: placeholder data until the backend exists.
export const load: PageLoad = () => ({
	waterOverlay: 0.5,
	profile: { name: "วิทยา รักจุฬา", code: "ABC12" },
	workshopLimit: 3,
	workshops: [
		{
			id: "banana-dna-1",
			title: "A minion mission : Banana DNA",
			department: "BBTECH & BISTECH",
			description,
			start: "2025-10-18T13:30:00+07:00",
			end: "2025-10-18T14:30:00+07:00",
		},
		{
			id: "banana-dna-2",
			title: "A minion mission : Banana DNA",
			department: "BBTECH & BISTECH",
			description,
			start: "2025-10-18T13:30:00+07:00",
			end: "2025-10-18T14:30:00+07:00",
		},
	] satisfies RegisteredWorkshop[],
	rewardTiers: [
		{ title: "ลูกเรือโจรสลัด", conditions, rewards },
		{ title: "รองหัวหน้าโจรสลัด", conditions, rewards },
		{ title: "กัปตันโจรสลัด", conditions, rewards },
	] satisfies RewardTier[],
});
