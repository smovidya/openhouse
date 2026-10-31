export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

// Keep the explicit +07:00 offset in these values. They are configuration,
// documentation, and frontend display data as well as comparison boundaries.
export const EVENT_SCHEDULE = Object.freeze({
  workshopRegistrationOpensAt: "2026-10-20T18:00:00+07:00",
  // Exclusive boundary. Closed early on event day (was 1 Nov 00:00); staff still add walk-ins.
  workshopRegistrationClosesAt: "2026-10-31T09:00:00+07:00",
  eventStartsAt: "2026-10-31T13:00:00+07:00",
  eventEndsAt: "2026-11-01T17:00:00+07:00",
});

export type TimeGateSnapshot = ReturnType<typeof getTimeGateSnapshot>;

export function getTimeGateSnapshot(now: Date, mocked = false) {
  const timestamp = now.getTime();
  const workshopRegistrationOpensAt = Date.parse(
    EVENT_SCHEDULE.workshopRegistrationOpensAt,
  );
  const workshopRegistrationClosesAt = Date.parse(
    EVENT_SCHEDULE.workshopRegistrationClosesAt,
  );
  const eventStartsAt = Date.parse(EVENT_SCHEDULE.eventStartsAt);
  const eventEndsAt = Date.parse(EVENT_SCHEDULE.eventEndsAt);

  return {
    timezone: BANGKOK_TIME_ZONE,
    now: now.toISOString(),
    mocked,
    schedule: EVENT_SCHEDULE,
    flags: {
      // General registration and sign-in have no scheduled opening time.
      signInOpen: true,
      generalRegistrationOpen: true,
      workshopRegistrationOpen:
        timestamp >= workshopRegistrationOpensAt &&
        timestamp < workshopRegistrationClosesAt,
      eventUpcoming: timestamp < eventStartsAt,
      eventInProgress: timestamp >= eventStartsAt && timestamp < eventEndsAt,
      eventEnded: timestamp >= eventEndsAt,
    },
  };
}

export type WorkshopRegistrationGateError =
  "WORKSHOP_REGISTRATION_NOT_OPEN" | "WORKSHOP_REGISTRATION_CLOSED";

export function getWorkshopRegistrationGateError(
  gates: TimeGateSnapshot,
): WorkshopRegistrationGateError | null {
  const now = Date.parse(gates.now);
  if (now < Date.parse(gates.schedule.workshopRegistrationOpensAt))
    return "WORKSHOP_REGISTRATION_NOT_OPEN";
  if (now >= Date.parse(gates.schedule.workshopRegistrationClosesAt))
    return "WORKSHOP_REGISTRATION_CLOSED";
  return null;
}

export function getWorkshopUnregistrationGateError(
  gates: TimeGateSnapshot,
): "WORKSHOP_REGISTRATION_CLOSED" | null {
  return Date.parse(gates.now) >=
    Date.parse(gates.schedule.workshopRegistrationClosesAt)
    ? "WORKSHOP_REGISTRATION_CLOSED"
    : null;
}
