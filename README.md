# Open House 2026

## Backend organization

Backend code is grouped by feature. Authentication is implemented as a backend API;
the other feature modules remain scaffolds. No sign-in UI is included yet.

```text
src/lib/
  features/
    auth/
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

Outside authentication, remote and service files are scaffolds. Attendees,
workshops, checkpoints, and rewards include initial input schemas. Survey validation
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
`requireStaff` from `auth/guards.server.ts`, plus any operation-specific permission
checks, before exposing private data or restricted changes.

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

`AuthSession` contains `{ user: { id, email, name, image, role }, expiresAt }`.
JWTs are only sent through HttpOnly cookies. Zod validates inputs directly without
an adapter. Authentication commands require a matching `Origin`, including locally.

The future Google client flow is:

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
The staff fixture has a `development` permission marker; feature-specific
permissions still need their own rules. Remote Cloudflare bindings are disabled
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
