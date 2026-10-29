// MOCK: no attendee lookup returns an email yet (it lives on `users`, and neither
// getAttendeeProfileByQrCodeId nor the attendance API joins it). Remove once one does.
// TODO(backend): attendee email in staff lookups.
export function mockAttendeeEmail(_attendee: { firstname: string }) {
  return "example@gmail.com";
}
