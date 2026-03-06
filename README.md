# doctor.com

Phase 1 initializes the backend with a clean monorepo layout: a thin `apps/server` runtime, `packages/api` for tRPC/modules, `packages/db` for Drizzle/PostgreSQL, `packages/auth` for Better-Auth setup, and `packages/shared` for DTOs/types/errors.

## Quickstart

```bash
bun install
cp apps/server/.env.example apps/server/.env
```

Set `DATABASE_URL` in `apps/server/.env`, then generate and run the initial migrations:

```bash
bun run db:generate
bun run db:migrate
```

Start the backend workspace:

```bash
bun run dev:server
```

The placeholder server listens on `http://localhost:3000`.

## Backend Structure

```text
apps/server/
  src/index.ts
packages/api/
  src/
    context.ts
    routers/
    trpc/
    modules/
    infrastructure/
packages/db/
  src/
    schema/
    migrations/
    index.ts
packages/auth/
  src/index.ts
packages/shared/
  src/
    schemas/
    types/
    errors/
```

## Notes

- The database schema is derived from `apps/server/DB.md`.
- No application endpoints or business logic are implemented in this phase.
- Better-Auth base setup is wired, but providers and auth flows remain TODOs.
