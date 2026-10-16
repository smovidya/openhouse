# Open House 2026

## Backend organization

Backend code is grouped by feature. Authentication is not implemented yet.

```text
src/lib/
  features/
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

| File | Responsibility |
| --- | --- |
| `schemas.ts` | Browser-safe Zod input schemas and inferred types |
| `<feature>.remote.ts` | Frontend-facing queries, forms, and commands |
| `service.server.ts` | Business rules, permissions, and database operations |

Remote and service files are scaffolds, with no callable operations yet. Attendees,
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
   the database with `getDb(d1)` using the current request's D1 binding.
4. Translate service outcomes into frontend results or form errors in the remote
   module, and refresh affected queries after successful mutations.
5. Import the operation directly from the feature remote module in a page or
   component, for example `#lib/features/workshops/workshops.remote`.

Keep identity, roles, checker IDs, generated IDs, and timestamps out of ordinary
user-editable input. Resolve them from trusted server context. Add authentication
and authorization before exposing operations that access private data or make
restricted changes.

The current Wrangler configuration does not declare a D1 binding. Configure one
and run `bun run cf-typegen` before wiring database-backed remote handlers. Database
construction stays inside request handling; do not store per-request identity or
bindings in module-level variables.

### Schema placement

- `schemas.ts` describes the operation the frontend can perform. It must not import
  Drizzle tables, private environment variables, or server modules at runtime.
- Drizzle's `$inferSelect` and `$inferInsert` provide types for internal database
  work without additional runtime validators.
- When an internal import or other boundary actually needs a database-derived Zod
  validator, add `db-schemas.server.ts` to its owning feature. Import
  `createInsertSchema`, `createUpdateSchema`, or `createSelectSchema` directly from
  `drizzle-orm/zod`, and import the table from `#lib/server/db/tables`.
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
bun run check
bun run build
```

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
