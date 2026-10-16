import { z } from "zod";
import type { PickerOption } from "#lib/components/ui/picker/index.js";
import {
	attendeeStatusOptions,
	isOption,
	majorOptions,
	newsSourceOptions,
	nonStudentStatuses,
	prefixOptions,
	visitIntentOptions,
} from "./options.js";

// Plain strings (not z.enum) so superforms defaults to "" instead of preselecting the first option.
const choice = (options: PickerOption[], message: string) =>
	z.string().refine((value) => isOption(options, value), message);

const text = (message: string, max = 200) => z.string().trim().min(1, message).max(max);

const registrationFields = z.object({
	prefix: choice(prefixOptions, "กรุณาเลือกคำนำหน้า"),
	prefixOther: z.string().trim().max(50),
	firstName: text("กรุณากรอกชื่อ", 100),
	lastName: text("กรุณากรอกนามสกุล", 100),
	age: z.number().int("กรุณากรอกอายุเป็นจำนวนเต็ม").min(1, "กรุณากรอกอายุ").max(120, "อายุไม่ถูกต้อง"),
	province: text("กรุณากรอกจังหวัด", 100),
	emergencyPhone: z.string().trim().regex(/^0\d{8,9}$/, "หมายเลขโทรศัพท์ไม่ถูกต้อง"),
	emergencyName: text("กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน", 200),
	specialNeeds: z.string().trim().max(500),
	reason: text("กรุณากรอกเหตุผลในการเข้าร่วม", 1000),
	expectation: text("กรุณากรอกสิ่งที่คาดหวัง", 1000),
	newsSources: z.array(choice(newsSourceOptions, "ช่องทางไม่ถูกต้อง")),
	visitIntent: choice(visitIntentOptions, "กรุณาเลือกตัวเลือก"),
	status: choice(attendeeStatusOptions, "กรุณาเลือกสถานะผู้เข้าร่วมงาน"),
	schoolName: z.string().trim().max(200),
	major1: z.string(),
	major2: z.string(),
	major3: z.string(),
});

type RegistrationFields = z.infer<typeof registrationFields>;

const majorKeys = ["major1", "major2", "major3"] as const;

function refineRegistration(data: RegistrationFields, ctx: z.RefinementCtx) {
	if (data.prefix === "other" && !data.prefixOther) {
		ctx.addIssue({ code: "custom", path: ["prefixOther"], message: "กรุณาระบุคำนำหน้า" });
	}

	if (nonStudentStatuses.has(data.status)) return;

	if (!data.schoolName) {
		ctx.addIssue({ code: "custom", path: ["schoolName"], message: "กรุณากรอกชื่อสถานศึกษา" });
	}
	if (!data.major1) {
		ctx.addIssue({ code: "custom", path: ["major1"], message: "กรุณาเลือกสาขาวิชาที่สนใจ" });
	}

	const seen = new Set<string>();
	for (const key of majorKeys) {
		const major = data[key];
		if (!major) continue;
		if (!isOption(majorOptions, major)) {
			ctx.addIssue({ code: "custom", path: [key], message: "สาขาวิชาไม่ถูกต้อง" });
		} else if (seen.has(major)) {
			ctx.addIssue({ code: "custom", path: [key], message: "เลือกสาขาวิชาซ้ำกัน" });
		}
		seen.add(major);
	}
}

/** Step 1: the registration form, validated before moving on to PDPA. */
export const registrationInfoSchema = registrationFields.superRefine(refineRegistration);

/** Step 2: everything plus PDPA consent. */
export const registrationSchema = registrationFields
	.extend({ pdpa: z.boolean().refine((accepted) => accepted, "กรุณายอมรับนโยบายข้อมูลส่วนบุคคล") })
	.superRefine(refineRegistration);

export type Registration = z.infer<typeof registrationSchema>;