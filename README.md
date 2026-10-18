# Open House 2027

## Workshop catalog

`src/lib/data/workshops.ts` contains the nine workshops and 40 rounds from
“เนื้อหา Workshop [Science Chula Open House 2027]”. The explicit dates in the
attachment are 31 October–1 November 2569 (2026), using Bangkok time.
The workshop pages use this catalog; attendance counts and registration remain
demo data until those pages are connected to the backend.

Per-round capacities follow the organizer’s confirmation: GEO/MATSCI/BISTECH 20,
FOODTECH 10, and BIOCHEM/MICRO/IMPRINT/BSAC & CHEM/BBTech 15.
To populate the database used by the workshop backend, run migrations followed by:

```sh
bun run workshops:seed
```

The seed keeps existing workshop/session IDs and registrations on repeat runs.
It updates matching slugs and rounds without deleting unrelated records.
Append `--remote --env production` to target production explicitly.

## Backend organization

Backend code is grouped by feature. Authentication, staff enrollment/permissions,
and checkpoint scanning have backend APIs. The home page includes a login demo;
enrollment UI is not yet included.

```text
src/lib/
  features/
    auth/
    staff/
    attendees/
    workshops/
    checkpoints/
    rewards/
    surveys/
  server/
    db/
      index.ts       # getDb(d1), Db type
      tables.ts      # exported Drizzle tables; Drizzle Kit schema entry point
      relations.ts   # relationships between tables
```

Each feature contains:

| File                  | Responsibility                                       |
| --------------------- | ---------------------------------------------------- |
| `schemas.ts`          | Browser-safe Zod input schemas and inferred types    |
| `<feature>.remote.ts` | Frontend-facing queries, forms, and commands         |
| `service.server.ts`   | Business rules, permissions, and database operations |

Attendees, workshops, rewards, and surveys remain service/remote scaffolds.
Attendees, workshops, and rewards include initial input schemas. Survey validation
is intentionally left for when the questionnaire is defined. Review input constraints
alongside each feature's requirements before implementing its operations.

### Adding an operation

1. Define its input in the feature's `schemas.ts` using Zod, and export a type with
   `z.infer<typeof schema>`. Use `z.strictObject` to reject unexpected fields.
2. Put business rules and database work in `service.server.ts`. Accept a `Db`
   argument and, when needed, a trusted actor. Keep cookies and SvelteKit request
   objects out of the service.
3. Export a `query`, `form`, or `command` from the feature's remote module. Pass
   the Zod schema directly to it; Zod supports Standard Schema without an adapter.
   Obtain request context with `getRequestEvent()` inside the handler and construct
   the database with `getDb(env.DB)` using `env` from `cloudflare:workers`.
4. Translate service outcomes into frontend results or form errors in the remote
   module, and refresh affected queries after successful mutations.
5. Import the operation directly from the feature remote module in a page or
   component, for example `#lib/features/workshops/workshops.remote.ts`.

Keep identity, roles, checker IDs, generated IDs, and timestamps out of ordinary
user-editable input. Resolve them from `locals.user`. Use `requireUser` or
`requireStaff` from `auth/guards.server.ts` for identity checks and
`requirePermission(user, "workshopStaff")` (or the appropriate permission) for
staff operations. Being staff alone does not authorize a module. For checkpoint
scanning, check the actual stored checkpoint's type and department.

Wrangler declares a local D1 binding named `DB`. Production requires its own binding
under `env.production`. Run `bun run cf-typegen` after changing bindings. Database
construction stays inside request handling; never store per-request identity in
module-level variables.

### Schema placement

- `schemas.ts` describes the operation the frontend can perform. It must not import
  Drizzle tables, private environment variables, or server modules at runtime.
- Drizzle's `$inferSelect` and `$inferInsert` provide types for internal database
  work without additional runtime validators.
- When an internal import or other boundary actually needs a database-derived Zod
  validator, add `db-schemas.server.ts` to its owning feature. Import
  `createInsertSchema`, `createUpdateSchema`, or `createSelectSchema` directly from
  `drizzle-orm/zod`, and import the table from `#db/tables.ts`.
- Keep database-derived validators server-only. Select allowed fields explicitly
  before using one for an operation; a table's full insert shape is not a public API.
- Let remote return types infer from explicitly selected response fields. Add a
  named shared response contract only when consumers need one.

Keep imports flowing from remote modules to services to the database. Services
must not import remote modules. A small read can stay in its remote handler; add a
repository only when database queries need separate ownership or substantial reuse.
`.server.ts` files are protected by SvelteKit's server-only import checks.

References: [remote functions](https://svelte.dev/docs/kit/remote-functions),
[server-only modules](https://svelte.dev/docs/kit/server-only-modules), and
[Drizzle's Zod integration](https://orm.drizzle.team/docs/zod).

### Verification

```sh
bun test
bun run check
bun run build
```

Tests exercise signed JWT verification, cookies, Google claim validation, origin
checks, and identity/fixture operations against an isolated local D1 database.
`checkJs` is disabled because Wrangler's generated binding declarations reference
the compiled worker JavaScript; TypeScript source remains strictly checked.

## Login demo

After completing the local setup below, open `http://localhost:5173/`.
Choose **Demo attendee** or **Demo staff** to exercise real local sessions without
a Google account. Sign out before switching profiles. The page shows the current
user, role, permissions, expiry, and an expandable session payload; reloading keeps
the session. Development profile buttons are absent from production builds and
`bun run preview`.

For Google login, choose **Start Google sign-in**, then use Google's rendered
button. The demo loads Google Identity Services, requests a signed nonce challenge,
and submits the returned credential through `auth.client.ts`. Register the exact
development origin in Google Cloud first. A blocked SDK or failed login displays
an error and allows another attempt; an unused challenge expires and can be restarted.

## Authentication API

For UI event handlers, import `beginGoogleSignIn`, `signInWithGoogle`,
`createDevSession`, and `logout` from `#lib/features/auth/auth.client.ts`.
The session-changing helpers await the remote command, then `refreshAll()` before
resolving. Callers do not need to refresh layout data themselves. Failed commands
do not trigger a refresh; refresh failures are propagated without retrying the
mutation. Starting a Google challenge does not change the session or refresh data.

The underlying `auth.remote.ts` and `dev.remote.ts` modules provide the transport;
calling their commands directly bypasses the client helpers' layout refresh.
SvelteKit generates their endpoints and input/output types; do not hardcode the
generated endpoint hashes. The server hook registers the remote modules so they
are available even before a UI imports them. `getSession` remains available from
`#lib/features/auth/auth.remote.ts` when a remote query is needed.

| Operation                                         | Input                                | Result                                                             |
| ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `beginGoogleSignIn()`                             | None                                 | `{ clientId, nonce }`; sets a signed, five-minute challenge cookie |
| `signInWithGoogle(...)`                           | `{ googleIdToken: string }`          | `AuthSession`; sets the session cookie                             |
| `getSession()`                                    | None                                 | `AuthSession` or `null`                                            |
| `logout()`                                        | None                                 | `{ success: true }`; clears session and challenge cookies          |
| `createDevSession(...)` from `auth/dev.remote.ts` | `{ profile: "attendee" \| "staff" }` | `AuthSession`; development only                                    |

`AuthSession` contains `{ user: { id, email, name, image, role, staff }, expiresAt }`.
`staff` is `null` or `{ id, permission: StaffPermission[] }` for an active staff
record. Permissions are loaded from D1, never trusted from JWT claims or UI state.
JWTs are only sent through HttpOnly cookies. Zod validates inputs directly without
an adapter. Authentication commands require a matching `Origin`, including locally.

The Google client flow is:

1. Call `beginGoogleSignIn()`.
2. Initialize Google Identity Services with the returned `clientId` and `nonce`.
3. Send its credential as `googleIdToken` to `signInWithGoogle()`.

Google's signature, issuer, audience, expiry, verified email, authorized party
(when present), and nonce are checked using cached public keys. No Google client
secret is needed. Register the app's exact origins in Google Cloud, including
`http://localhost:5173` for the default development server.

Users are identified by Google's `sub`, enforced by a unique database index.
New users receive the attendee role; later logins update their Google profile
without changing their role. Matching email addresses do not link accounts.
Google sign-in creates the user identity only; collecting attendee registration
details remains a separate feature. Soft-deleted accounts cannot sign in.

### Session behavior and module ownership

- `schemas.ts`: public Zod inputs and session types.
- `google.server.ts`: Google token verification.
- `session.server.ts`: JWT signing/verification, cookies, and login challenges.
- `service.server.ts`: user lookup and atomic identity creation/update.
- `config.server.ts`: validated configuration and database access.
- `guards.server.ts`: authentication, role, and origin checks.
- `dev-fixtures.server.ts`: repeatable local attendee/staff fixtures.
- `auth.remote.ts` and `dev.remote.ts`: frontend-facing commands and queries.
- `auth.client.ts`: UI auth helpers that refresh layout data after session changes.

Sessions have a fixed 24-hour lifetime, with no automatic renewal. Production uses
a Secure, HttpOnly, SameSite=Lax, host-only `__Host-session` cookie. Development
uses a separate local cookie and JWT audience. The hook verifies the JWT and reads
the active user on every authenticated request, so role changes and soft deletion
take effect immediately. It populates `locals.user` and `locals.session`;
`+layout.server.ts` exposes the safe session as `data.session` in layouts/pages.
Nested components can read `page.data.session` using `page` from `$app/state`;
`App.PageData` supplies its `AuthSession | null` type. Use `$derived` if assigning
it to a local reactive variable. No separate context or writable session store is
needed. The client helpers refresh both layout data and active queries after
Google sign-in, development sign-in, or logout.

Logout clears this browser's cookie. It does not revoke a copied JWT, which remains
valid until expiry unless the user is disabled or the signing key is rotated.

### Local setup without a .env file

```sh
bun install
export AUTH_JWT_SECRET="$(openssl rand -hex 32)"
bun run db:migrate:local
bun run dev
```

The public `GOOGLE_CLIENT_ID` is already in `wrangler.jsonc`. The app's separate
JWT signing secret must be exactly 64 hexadecimal characters. Wrangler reads it
from the shell environment; no environment file is added. Keep the same secret in
your shell to retain sessions across restarts. A newly generated key invalidates
existing sessions. Never commit the secret or expose it to client code.

`createDevSession` creates or reuses fixed local users and matching attendee/staff
records, then follows the normal JWT/cookie/session path. Existing fixtures are
not reset, so local role changes and disabled-user scenarios remain testable.
New staff fixtures have `boothStaff:all`; existing fixture permissions are preserved.
The migration clears the old free-text `development` marker to an empty permission
list. Enroll/redeem an invite or seed the local first admin to grant access to an
older fixture. Remote Cloudflare bindings are disabled
in the development adapter. Mock login returns 404 in production builds,
including `bun run preview`; it cannot be enabled by a request parameter.

### Production setup

1. Configure the real D1 binding under `env.production.d1_databases` with binding
   `DB`, its database name/ID, `migrations_dir: "drizzle"`, and
   `migrations_pattern: "drizzle/*/migration.sql"`; run `bun run cf-typegen`.
2. Store a separate 64-character hex `AUTH_JWT_SECRET` using Cloudflare's secret
   settings or `bunx wrangler secret put AUTH_JWT_SECRET --env production`.
3. Apply migrations to that database with
   `bunx wrangler d1 migrations apply DB --remote --env production`.
4. Build and deploy to that environment with
   `bun run build && bunx wrangler deploy --env production`.

The Google identity migration adds a unique index. If an existing database has
duplicate Google IDs, reconcile those accounts before applying it; the migration
intentionally fails rather than deleting data. No production resources or secrets
are created by the local setup.

## Staff enrollment and permissions

Staff permissions are a deduplicated JSON array in `staffs.permission`. The five
access categories are:

| Permission                                        | Access                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `admin`                                           | Every staff module, every checkpoint, and invite-code management                                 |
| `boothStaff:all`                                  | View and scan every configured department's booth checkpoints                                    |
| `boothStaff:physics` (or another department slug) | View and scan only that department's booth checkpoints                                           |
| `workshopStaff`                                   | View and scan all workshop checkpoints; use this permission for future workshop staff operations |
| `activityStaff`                                   | View and scan entry, stage, and reward checkpoints                                               |

Permissions combine: a staff member can hold both `boothStaff:physics` and
`workshopStaff`. `boothStaff:all` does not grant workshop/activity access. An
account marked `staff` without an active staff record or matching permissions
cannot use restricted operations.

Each booth checkpoint has one `department`, such as `physics` or `chemistry`.
Use lowercase slugs matching `[a-z][a-z0-9-]{0,63}` and reserve `all` for the
wildcard permission. The department list comes from active booth checkpoints,
not from a separate hardcoded list. Set checkpoint departments in D1 before
issuing department-specific codes; invite creation rejects unknown departments.
The staff profile's optional department is descriptive and never grants access.

### Backend operations

`#lib/features/staff/staff.remote.ts` exports:

| Operation                | Input                                      | Access/result                                                                           |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `getMyStaffProfile()`    | None                                       | Signed-in user's active profile or `null`                                               |
| `listBoothDepartments()` | None                                       | Signed-in user; active booth department slugs                                           |
| `enrollStaff(...)`       | `{ name, phone, type, department?, code }` | Signed-in user; creates staff profile, adds invite permissions, returns updated session |
| `redeemInviteCode(...)`  | `{ code }`                                 | Existing active staff; adds invite permissions and returns updated session              |
| `createInviteCode(...)`  | `{ permission: StaffPermission[] }`        | Admin; returns invite metadata and generated reusable code                              |
| `listInviteCodes(...)`   | `{ offset?: number, limit?: number }`      | Admin; active/disabled invite metadata, never codes or hashes                           |
| `disableInviteCode(...)` | `{ id }`                                   | Admin; sets the invite's `deletedAt`                                                    |

Enrollment collects `name`, `phone`, and descriptive `type` (for example `student`
or `organizer`), plus optional `department`. It takes the user ID from the current
session and permissions from the invite. Supplying `role`, `permission`, or another
user ID in the enrollment input is rejected. Existing attendee records are kept
when the user's account role changes to `staff`. A signed-in attendee without a
completed attendee profile can enroll too; there is no extra `roleless` account
role. Re-enrollment preserves existing staff profile details and adds permissions.

Codes are case-sensitive, reusable across people, and have no expiry or usage
limit. A code can grant multiple permissions, including `admin`. Creation returns
the code once for sharing; D1 stores its SHA-256 hash. Invalid and disabled codes
return the same error. Disabling a code stops future redemptions without revoking
permissions already granted. Soft-deleted staff/users cannot use codes to restore
their access. Repeated redemptions do not duplicate permissions, and simultaneous
redemptions merge safely.

Future UI handlers should import `enrollStaff` and `redeemInviteCode` from
`#lib/features/staff/staff.client.ts`. These helpers await `refreshAll()` after a
successful command, keeping `page.data.session.user.staff.permission` up to date.
Promotion retains the session's original expiry. The raw remote commands refresh
`getSession` and `getMyStaffProfile`, but callers bypassing the client helpers must
refresh layout data themselves. Refresh invite listings after creating/disabling
a code.

### Checkpoint scanning

`#lib/features/checkpoints/checkpoints.remote.ts` exports:

- `listScannableCheckpoints({ offset?, limit? })`: only active checkpoints allowed
  by the current user's permissions. Lists default to 50, with a maximum of 100.
- `checkInAttendee({ qrCodeId, checkpointId })`: verifies access against the stored
  checkpoint, resolves the active attendee, and records the authenticated staff
  ID as checker. Returns `{ attendee, checkpointId, log, alreadyCheckedIn }`.

The database permits one active log per attendee/checkpoint. Repeated or concurrent
scans return the same log, so they cannot inflate the attendance count used for
prize eligibility. Scanning a reward checkpoint records attendance only; it does
not create a reward redemption or determine prize eligibility. Those business
rules remain in the rewards feature. Booths without a configured department are
not accessible to booth staff until configured; admins can still access them.

Shared UI helpers `hasPermission` and `canScanCheckpoint` live in
`staff/permissions.ts`. They can control module visibility, but server guards and
services remain authoritative. Permissions are reloaded from D1 on each request;
removing a grant or soft-deleting a staff record takes effect on subsequent requests.

### First-admin seed and migration

Apply migrations, then have the intended admin sign in once with Google. Use their
**user ID** from the session, not their Google ID or email:

```sh
bun run db:migrate:local
bun run staff:seed-admin --user-id USER_ID --name "Admin Name" --phone 0123456789
```

The seed defaults to local D1 and `type: "organizer"`. It optionally accepts
`--type` and `--department`. For the configured production database, explicitly
select both the remote database and environment:

```sh
bunx wrangler d1 migrations apply DB --remote --env production
bun run staff:seed-admin --user-id USER_ID --name "Admin Name" --phone 0123456789 --remote --env production
```

The seed grants the first active admin, can safely be retried for that user, and
refuses to bootstrap a second admin while one exists. Existing admins create admin
invites for additional admins. The command requires an existing active account;
it does not fabricate a Google identity or revive a deleted staff record.

The staff migration adds invite storage, checkpoint departments, a unique staff
record per user, unique attendee QR codes, and unique active checkpoint logs.
Legacy non-JSON staff permission strings become `[]`; JSON arrays are preserved.
Duplicate staff user IDs, QR codes, or active attendee/checkpoint pairs must be
resolved before migration; records are not silently deleted.

## Project setup

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@1.1.1 create --template minimal --types ts --add drizzle="database:d1" tailwindcss="plugins:forms,typography" ai-tools="ide:claude-code,gemini,opencode,vscode+delivery:plugin+tools:mcp,svelte-code-writer,svelte-core-bestpractices,svelte-file-editor+mcpSetup:local" --install bun openhouse26
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
