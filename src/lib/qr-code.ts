// Attendee QR codes as selfRegisterAttendee (attendees.remote.ts) generates them: 5 characters
// from an alphabet without look-alikes, upper case only.
// TODO: use the backend's schema instead once it validates the format (it takes any string now).
export const QR_CODE_ALPHABET = "2345679ACDEFGHJKLMNPQRSTUVWXYZ%#@";
export const QR_CODE_LENGTH = 5;

const qrCodePattern = new RegExp(`^[${QR_CODE_ALPHABET}]{${QR_CODE_LENGTH}}$`);

export type ParsedQrCode =
  { kind: "valid"; code: string } | { kind: "invalid" };

/**
 * A scanned or typed code, upper-cased so staff can type it in lower case. With `allowAny`
 * (development), other non-empty input passes as typed: dev fixtures use codes like
 * `dev-attendee-qr`.
 */
export function parseQrCode(
  input: string,
  { allowAny = false }: { allowAny?: boolean } = {},
): ParsedQrCode {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (qrCodePattern.test(upper)) return { kind: "valid", code: upper };
  if (allowAny && trimmed) return { kind: "valid", code: trimmed };
  return { kind: "invalid" };
}
