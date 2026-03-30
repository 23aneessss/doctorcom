# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project Overview

`doctor.com` is a Bun + Turborepo monorepo for a medical clinic management system.
Stack: Bun, TypeScript, Express, tRPC, Drizzle ORM, PostgreSQL, Better-Auth, MinIO.

Backend business logic lives in `packages/api/src/modules/<module>/` — NOT in `apps/server`.
`apps/server` is only the Express runtime that mounts tRPC and auth.

## Commands

### Dev

```bash
bun run dev              # all apps via turbo
bun run dev:server       # server only
bun run dev:web          # web only
bun run dev:native       # mobile only
```

### Type Checking

```bash
bun run check-types              # all packages
bun run check-types:backend      # backend packages only (preferred)
bunx tsc --noEmit -p packages/api/tsconfig.json   # api package only
```

### Build

```bash
bun run build
```

### Database

```bash
bun run db:generate      # generate migration from schema changes
bun run db:migrate       # run migrations
bun run db:push          # push schema directly (no migration file)
bun run db:studio        # open Drizzle Studio
bun run db:seed          # seed main DB
bun run db:reset         # reset main DB
bun run medications-db:generate   # same for medications DB
bun run medications-db:migrate
bun run medications-db:push
bun run medications-db:studio
bun run medications-db:seed
```

### Tests

```bash
bun run ai:anomaly:test              # anomaly detection test
bun run ai:anomaly:test:reseed       # anomaly test with reseed
bun run test:export                  # export module test (from apps/server)
```

There is no general test runner (jest/vitest) configured. Testing is done via
dedicated scripts. Run `bun <path-to-script>` for ad-hoc tests.

### Other

```bash
bun install              # install dependencies
bun run minio:up         # start MinIO via docker compose
```

## Architecture

Each backend module follows a strict 3-file pattern:

```
packages/api/src/modules/<module>/
  repo.ts      # database access only (SELECT, INSERT, UPDATE, DELETE)
  service.ts   # business logic, calls repo functions
  router.ts    # tRPC endpoints, Zod input validation, calls services
```

**The router must NEVER access the database directly.** Always go through service → repo.

Exposed modules: `agenda`, `ai`, `auth`, `consultation`, `documents`, `export`,
`medicalHistory`, `medicaments`, `ordonnance`, `patient`, `travel`, `treatment`, `vaccination`.

AI sub-modules live under `packages/api/src/modules/ai/` with the same pattern.

File upload endpoints are in `apps/server/src/routes/upload.ts` (multer + MinIO),
mounted at `/api/upload`.

## Two Databases

- **Main DB** (`DATABASE_URL`): patients, consultations, users, auth, documents, etc.
  Package: `packages/db`
- **Medications DB** (`MEDICATIONS_DATABASE_URL`): medication catalog, substances, interactions.
  Package: `packages/medications-db`

## Code Style

### TypeScript

- `strict: true` with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- Use `import type { ... }` for type-only imports (enforced by `verbatimModuleSyntax`)
- ESM only (`"type": "module"`)

### Imports

```typescript
// External packages first
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Workspace packages
import { db } from "@doctor.com/db";
import type { SomeType } from "@doctor.com/shared";

// Relative (use `./` or `../`)
import { someRepo } from "./repo";
```

### Naming

- **Files**: `repo.ts`, `service.ts`, `router.ts` per module
- **Functions (repo)**: `getById`, `create`, `update`, `delete`, `findByEmail`
- **Functions (service)**: business-action names, e.g. `creerDocument`, `getPatientAge`
- **Functions (router/tRPC)**: French verbs for mutations, `get*` / `list*` for queries
- **Variables**: camelCase
- **DB columns**: snake_case (matches Drizzle schema)
- **Zod schemas**: `*InputSchema`, e.g. `documentBaseInputSchema`

### tRPC Procedures

```typescript
// Protected (auth required) — use for almost everything
protectedProcedure.input(zodSchema).mutation(async ({ ctx, input }) => { ... });
protectedProcedure.input(zodSchema).query(async ({ ctx, input }) => { ... });

// Public (no auth) — rare, only for auth endpoints
publicProcedure.input(zodSchema).query(async ({ ctx, input }) => { ... });
```

The session user email is at `ctx.session.user.email`. Most services re-resolve
the business user from the DB using this email.

### Error Handling

- Throw `TRPCError` from services with appropriate codes: `NOT_FOUND`, `UNAUTHORIZED`,
  `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, `CONFLICT`
- Validate all inputs with Zod in the router layer
- Validate existence before mutations (e.g. check patient exists before creating document)

### Database

- Use Drizzle ORM for all queries — no raw SQL
- Schema files in `packages/db/src/schema/`
- Migrations auto-generated with `drizzle-kit`

## Branch Conventions

```
feat/<module>-<short-desc>
fix/<module>-<short-desc>
chore/<scope>-<short-desc>
```

## Rules

1. Modify only one module per task. Do not touch other modules.
2. Do not change the database schema without running `db:generate` and committing the migration.
3. Always run `bun run check-types:backend` before committing.
4. The router must never access the database directly.
5. Use Zod for all endpoint input validation.
6. Follow the `repo → service → router` layering strictly.
7. Use `import type` for type-only imports.
8. Commit schema + migration in the same commit.
