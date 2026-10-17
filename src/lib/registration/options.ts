import type { PickerOption } from "#lib/components/ui/picker/index.js";

export const prefixOptions: PickerOption[] = [
  { value: "master", label: "ด.ช." },
  { value: "miss-child", label: "ด.ญ." },
  { value: "mr", label: "นาย" },
  { value: "mrs", label: "นาง" },
  { value: "miss", label: "นางสาว" },
  { value: "other", label: "อื่น ๆ" },
];

export const attendeeStatusOptions: PickerOption[] = [
  { value: "upper-secondary", label: "มัธยมศึกษาตอนปลาย" },
  { value: "lower-secondary", label: "มัธยมศึกษาตอนต้น" },
  { value: "primary", label: "ประถมศึกษา" },
  { value: "parent", label: "ผู้ปกครอง" },
  { value: "vocational-certificate", label: "ปวช." },
  { value: "high-vocational-certificate", label: "ปวส." },
  { value: "bachelor", label: "ปริญญาตรี" },
  { value: "master", label: "ปริญญาโท" },
  { value: "other", label: "อื่น ๆ" },
];

/** Statuses that skip the school name and interested-major questions. */
export const nonStudentStatuses = new Set(["parent", "other"]);

// TODO: final list pending from the organizers.
export const newsSourceOptions: PickerOption[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "other", label: "อื่น ๆ" },
];

export const visitIntentOptions: PickerOption[] = [
  { value: "intended", label: "ตั้งใจมางานนี้" },
  { value: "walk-in", label: "เดินผ่านมา" },
];

// Faculty of Science departments and programmes, in the student union's order.
// Source: https://sucu.sc.chula.ac.th/organizations/departments/
// Values follow the department slugs used by staff permissions (e.g. boothStaff:physics).
export const majorOptions: PickerOption[] = [
  { value: "math-cs", label: "คณิตศาสตร์และวิทยาการคอมพิวเตอร์" },
  { value: "chemistry", label: "เคมี" },
  { value: "physics", label: "ฟิสิกส์" },
  { value: "biology", label: "ชีววิทยา" },
  { value: "botany", label: "พฤกษศาสตร์" },
  { value: "chemical-technology", label: "เคมีเทคนิค" },
  { value: "environmental-science", label: "วิทยาศาสตร์สิ่งแวดล้อม" },
  { value: "materials-science", label: "วัสดุศาสตร์" },
  { value: "bbtech", label: "เทคโนโลยีชีวภาพ (นานาชาติ)" },
  { value: "microbiology", label: "จุลชีววิทยา" },
  { value: "marine-science", label: "วิทยาศาสตร์ทางทะเล" },
  { value: "bsac", label: "เคมีประยุกต์" },
  { value: "food-technology", label: "เทคโนโลยีทางอาหาร" },
  { value: "geology", label: "ธรณีวิทยา" },
  { value: "biochemistry", label: "ชีวเคมี" },
  { value: "imaging-printing", label: "เทคโนโลยีทางภาพและการพิมพ์" },
];

export const isOption = (options: PickerOption[], value: string) =>
  options.some((option) => option.value === value);
