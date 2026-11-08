import { z } from "zod";
import { prefixOptions } from "#lib/registration/options.ts";
import { EVENT_SCHEDULE } from "#lib/constants/time.ts";
import { normalizeCertificateText } from "./normalization";

export const CERTIFICATE_EVENT = Object.freeze({
  id: "scoh27",
  title: "Science Chula Open House 2027",
  startsAt: EVENT_SCHEDULE.eventStartsAt,
  endsAt: EVENT_SCHEDULE.eventEndsAt,
  awardDate: "2026-11-01",
  type: "participation",
});
export const rawNameSchema = z.object({
  title: z.string().max(40),
  customTitle: z.string().max(120),
  school: z.string().max(180),
  firstName: z.string().max(120),
  lastName: z.string().max(120),
});
export const nameSnapshotSchema = z.object({
  school: z.string().max(180),
  title: z.string().min(1).max(120),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  displayName: z.string().min(1).max(364),
});
export type RawName = z.infer<typeof rawNameSchema>;
export type NameSnapshot = z.infer<typeof nameSnapshotSchema>;
export const confirmationSchema = z.object({
  raw: rawNameSchema,
  reviewed: nameSnapshotSchema,
});
export type Confirmation = z.infer<typeof confirmationSchema>;

export function reviewName(raw: RawName): NameSnapshot {
  const option = prefixOptions.find((option) => option.value === raw.title);
  if (!option) throw new Error("กรุณาเลือกคำนำหน้า");
  const title =
    raw.title === "other"
      ? normalizeCertificateText(raw.customTitle)
      : option.label;
  const firstName = normalizeCertificateText(raw.firstName);
  const lastName = normalizeCertificateText(raw.lastName);
  const school = normalizeCertificateText(raw.school);
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(school) || school.length > 180)
    throw new Error("กรุณาตรวจสอบชื่อสถานศึกษา");
  const displayName = `${title} ${firstName} ${lastName}`;
  for (const value of [title, firstName, lastName]) {
    if (
      !value ||
      value.length > 120 ||
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
    )
      throw new Error(
        "กรุณาตรวจสอบคำนำหน้า ชื่อ และนามสกุล (ไม่เกินช่องละ 120 ตัวอักษร)",
      );
  }
  return { title, firstName, lastName, displayName, school };
}
export function sameName(a: NameSnapshot, b: NameSnapshot) {
  return (
    a.school === b.school &&
    a.title === b.title &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.displayName === b.displayName
  );
}
export function registrationCertificateName(profile: {
  title: string;
  prefixOther: string | null;
  school: string | null;
  firstname: string;
  lastname: string;
}): RawName {
  const option = prefixOptions.find(
    (option) =>
      option.value !== "other" &&
      (option.value === profile.title || option.label === profile.title),
  );
  return {
    school: profile.school ?? "",
    title: option?.value ?? "other",
    customTitle: option ? "" : profile.prefixOther || profile.title,
    firstName: profile.firstname,
    lastName: profile.lastname,
  };
}
export type CertificateState = {
  eligible: boolean;
  configured: boolean;
  raw: RawName;
  issuance: null | {
    id: string;
    name: NameSnapshot;
    event: typeof CERTIFICATE_EVENT;
    status: "pending" | "generating" | "ready" | "failed" | "revoked";
  };
};
