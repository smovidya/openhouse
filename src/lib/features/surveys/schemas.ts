// The evaluation questionnaire (ฟอร์มประเมินผล) is stored in survey_responses.answer
// as JSON, but only this strict shape is accepted — never arbitrary JSON.
// The 1–4 fields are satisfaction ratings; 0 marks "unanswered" so superform keeps
// a number, and min(1) surfaces the Thai message instead of a raw required error.

import { z } from "zod";
import type { PickerOption } from "#lib/components/ui/picker/index.js";
import { isOption, majorOptions } from "#lib/registration/options.js";

// Plain strings (not z.enum) so superforms defaults to "" instead of preselecting the first option.
const choice = (options: PickerOption[], message: string) =>
  z.string().refine((value) => isOption(options, value), message);

const rating = (message: string) =>
  z.number().int(message).min(1, message).max(4, message).default(0);

export const evaluationPurposeOptions: PickerOption[] = [
  { value: "study", label: "สนใจศึกษาต่อ" },
  { value: "venue", label: "ดูสถานที่และบรรยากาศ" },
  { value: "friends", label: "มาเป็นเพื่อนกับเพื่อน" },
  { value: "certificate", label: "รับเกียรติบัตร" },
  { value: "workshop", label: "เข้าร่วมเวิร์กช็อป" },
  { value: "program", label: "ศึกษาข้อมูลหลักสูตร" },
  { value: "meet-students", label: "พบกับนิสิตที่กำลังศึกษาในภาควิชาที่สนใจ" },
];

export const continueStudyOptions: PickerOption[] = [
  { value: "interested", label: "สนใจศึกษาต่อ" },
  { value: "considering", label: "ขอพิจารณาก่อน" },
  { value: "not-interested", label: "ไม่สนใจ" },
];

export const evaluationResponseSchema = z.object({
  // จุดประสงค์การเข้าร่วม
  purpose: z
    .array(choice(evaluationPurposeOptions, "จุดประสงค์ไม่ถูกต้อง"))
    .min(1, "กรุณาเลือกจุดประสงค์ในการเข้าร่วมงาน"),
  // ภาควิชา
  departments: z
    .array(choice(majorOptions, "ภาควิชาไม่ถูกต้อง"))
    .min(1, "กรุณาเลือกภาควิชาที่สนใจ"),
  favoriteDepartment: choice(majorOptions, "กรุณาเลือกบูธภาควิชาที่ชื่นชอบ"),
  boothActivitiesRating: rating("กรุณาให้คะแนนกิจกรรมในบูธต่าง ๆ"),
  // สถานที่จัดงาน
  venueCrowdRating: rating("กรุณาให้คะแนนความแออัดของสถานที่จัดงาน"),
  venueTravelRating: rating("กรุณาให้คะแนนความสะดวกในการเดินทาง"),
  venueToiletRating: rating("กรุณาให้คะแนนความเพียงพอของห้องสุขา"),
  venueMedicalRating: rating("กรุณาให้คะแนนความเหมาะสมของจุดพยาบาล"),
  venueCleanlinessRating: rating("กรุณาให้คะแนนความสะอาดภายในงาน"),
  // การลงทะเบียน
  websiteAccessRating: rating("กรุณาให้คะแนนการเข้าถึงเว็บไซต์"),
  websiteUsabilityRating: rating("กรุณาให้คะแนนความง่ายในการใช้งานเว็บไซต์"),
  websiteAppearanceRating: rating("กรุณาให้คะแนนความสวยงามของเว็บไซต์"),
  // กิจกรรม
  activityInfoRating: rating("กรุณาให้คะแนนความครบถ้วนของข้อมูล"),
  activityWorkshopSignupRating: rating(
    "กรุณาให้คะแนนระยะเวลาลงทะเบียนเวิร์กช็อป",
  ),
  activityWorkshopAccessRating: rating("กรุณาให้คะแนนการเข้าร่วมเวิร์กช็อป"),
  activitySouvenirRating: rating("กรุณาให้คะแนนของที่ระลึก"),
  // เวิร์กช็อป
  workshopContentRating: rating("กรุณาให้คะแนนเนื้อหาของเวิร์กช็อป"),
  // ภาพรวม
  overallRating: rating("กรุณาให้คะแนนความพึงพอใจโดยรวม"),
  recommendRating: rating("กรุณาให้คะแนนการแนะนำงานผู้อื่น"),
  continueStudy: choice(continueStudyOptions, "กรุณาเลือกคำตอบ"),
  // ข้อเสนอแนะ/ติชม
  comment: z.string().trim().max(2000, "ข้อความยาวเกินไป กรุณาตอบให้สั้นลง"),
  // บูธภาควิชา (อ้างอิงบูธที่ชื่นชอบที่สุด)
  boothContentRating: rating("กรุณาให้คะแนนเนื้อหาของบูธ"),
  boothCommunicationRating: rating("กรุณาให้คะแนนการสื่อสารของทีมงานบูธ"),
  boothMediaRating: rating("กรุณาให้คะแนนสื่อนำเสนอของบูธ"),
});

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
