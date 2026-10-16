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

// TODO: placeholder, replace with the real 20 majors.
export const majorOptions: PickerOption[] = Array.from({ length: 20 }, (_, i) => ({
	value: `major-${i + 1}`,
	label: `สาขาที่ ${i + 1}`,
}));

export const isOption = (options: PickerOption[], value: string) =>
	options.some((option) => option.value === value);
