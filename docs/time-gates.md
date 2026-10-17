# Time gates

All configured times use `Asia/Bangkok` (`UTC+07:00`). The server evaluates
the flags, and mutation endpoints enforce them even when the frontend is
bypassed.

| Gate                                  | Bangkok time              | Behavior                                                                        |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| General registration and sign-in open | 20 Oct 2026, 12:00        | Google sign-in, development sign-in, and attendee registration become available |
| Workshop registration opens           | 20 Oct 2026, 18:00        | Attendees can register for workshops                                            |
| Workshop registration closes          | End of 31 Oct 2026, 23:59 | The exclusive code boundary is 1 Nov 2026, 00:00                                |
| Event starts                          | 31 Oct 2026, 13:00        | `eventInProgress` becomes true                                                  |
| Event ends                            | 1 Nov 2026, 18:00         | `eventEnded` becomes true                                                       |

The confirmed workshop deadline falls after the event starts on 31 October.

## Frontend API

```ts
import {
  clearMockTime,
  getTimeGates,
  setMockTime,
} from "#lib/features/time/time.remote";

const gates = await getTimeGates();

if (gates.flags.generalRegistrationOpen) {
  // Show sign-in and the attendee registration form.
}

if (gates.flags.workshopRegistrationOpen) {
  // Show workshop registration controls.
}
```

`getTimeGates()` returns the effective ISO timestamp, `Asia/Bangkok`, whether
the clock is mocked, the configured schedule, and these flags:

- `signInOpen`
- `generalRegistrationOpen`
- `workshopRegistrationOpen`
- `eventUpcoming`
- `eventInProgress`
- `eventEnded`

## Development clock

The development commands store an HttpOnly cookie in the current browser, so
one developer can test a date without changing the clock for anyone else.
They validate same-origin requests and return HTTP 404 in production.

```ts
await setMockTime({ now: "2026-10-20T18:00:00+07:00" });
await getTimeGates().refresh();

await clearMockTime();
await getTimeGates().refresh();
```

The commands already schedule a server-driven refresh of `getTimeGates`; the
explicit refresh above is useful when calling them outside a rendered query
consumer. Pass an RFC 3339 timestamp with an explicit offset. Reloading the
page preserves the mocked time. `clearMockTime()` returns the browser to the
real clock.

When closed, attendee and workshop commands return neverthrow errors:

- `GENERAL_REGISTRATION_NOT_OPEN`
- `WORKSHOP_REGISTRATION_NOT_OPEN`
- `WORKSHOP_REGISTRATION_CLOSED`

Sign-in commands reject with `SIGN_IN_NOT_OPEN`.

## Workshop unregistration

Attendees can unregister through the final millisecond before the workshop
registration deadline. The command resolves the attendee from the signed-in
user, so the frontend cannot cancel another attendee's registration.

```ts
import { unregisterFromWorkshop } from "#lib/features/workshops/workshops.remote";

const result = await unregisterFromWorkshop({
  workshopSlug: "chemistry-lab",
  workshopRoundNumber: 1,
});
```

The command returns the soft-deleted registration in `Ok`. It returns one of
these neverthrow error codes when it cannot unregister:

- `ATTENDEE_NOT_FOUND`
- `WORKSHOP_REGISTRATION_NOT_FOUND`
- `WORKSHOP_REGISTRATION_CLOSED`
- `UNREGISTER_FROM_WORKSHOP_FAILED`
