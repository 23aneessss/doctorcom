# doctor.com

Monorepo Bun + Turborepo pour un backend medical scaffold:

- `apps/server`: runtime Express (boot serveur + montage tRPC/Better-Auth).
- `packages/api`: couche tRPC (context, router racine, modules placeholders).
- `packages/db`: Drizzle schema + migrations + client PostgreSQL.
- `packages/auth`: configuration Better-Auth.
- `packages/shared`: DTO Zod, types inferes, erreurs applicatives.
- `apps/web`: client web (TanStack Router) relie au backend scaffold.

Le detail complet de l’architecture `packages/` est dans [packagesARCH.md](./packagesARCH.md).

## Etat du projet

Le repo est **ready pour commencer a travailler en equipe** sur la phase suivante, avec ces conditions:

- typecheck global OK (`bun run check-types`).
- migrations Drizzle synchronisees (`bun run db:generate` -> no changes).
- structure modules/repo/service prete.

Important:

- la logique metier/API n’est pas implementee (scaffold volontaire).
- Better-Auth est cable, mais les flows providers/metier restent a completer.

## Prérequis

1. Bun installe (version recommandee: `1.2.20` ou proche).
2. Docker Desktop lance (pour PostgreSQL local via `docker compose`).
3. Git + terminal.

Verifier rapidement:

```bash
bun --version
docker --version
docker compose version
```

## Installation (premier lancement)

Depuis la racine du repo:

```bash
bun install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Variables principales a connaitre:

- `apps/server/.env`
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/doctor_com`
  - `BETTER_AUTH_SECRET=...` (minimum 32 caracteres)
  - `BETTER_AUTH_URL=http://localhost:3000`
  - `CORS_ORIGIN=http://localhost:5173`
- `apps/web/.env`
  - `VITE_SERVER_URL=http://localhost:3000`

## Démarrage rapide (backend + DB + web)

1. Demarrer PostgreSQL local:

```bash
bun run db:start
```

2. Generer puis appliquer les migrations:

```bash
bun run db:generate
bun run db:migrate
```

3. Demarrer le serveur backend:

```bash
bun run dev:server
```

4. (Optionnel) Demarrer le web:

```bash
bun run dev:web
```

URLs utiles:

- Backend: `http://localhost:3000`
- Health texte placeholder: `GET /` -> `server running`
- tRPC mount: `http://localhost:3000/trpc`
- Auth Better-Auth: `http://localhost:3000/api/auth/*`
- Web: `http://localhost:5173`

## Commandes racine a connaitre

## Qualite / Build

```bash
bun run check-types
```
Typecheck global du monorepo (gate principal).

```bash
bun run check-types:backend
```
Typecheck backend uniquement (`server`, `api`, `db`, `auth`, `shared`).

```bash
bun run build
```
Build Turbo de tous les workspaces qui exposent `build`.

## Dev

```bash
bun run dev
```
Lance `turbo dev` (multi-workspace).

```bash
bun run dev:server
bun run dev:web
bun run dev:native
```
Lance un workspace cible.

## Base de donnees

```bash
bun run db:start
bun run db:watch
bun run db:stop
bun run db:down
```
Controle du conteneur PostgreSQL local.

```bash
bun run db:generate
```
Genere migration SQL a partir des schemas Drizzle.

```bash
bun run db:migrate
```
Applique les migrations.

```bash
bun run db:push
```
Push direct schema -> DB (utile surtout en dev rapide, moins traceable qu’une migration versionnee).

```bash
bun run db:studio
```
Lance Drizzle Studio.

## Commandes workspace (quand tu veux cibler un package/app)

Exemples utiles:

```bash
bun run --cwd apps/server dev
bun run --cwd apps/server check-types
bun run --cwd apps/web check-types
bun run --cwd apps/web routes:generate
bun run --cwd apps/web routes:watch
bun run --cwd packages/db check-types
bun run --cwd packages/db db:generate
```

## Workflow recommandé pour l’equipe

## Quand tu modifies la base de donnees

1. Modifier `packages/db/src/schema/*`.
2. Lancer `bun run db:generate`.
3. Verifier le SQL genere dans `packages/db/src/migrations/*`.
4. Lancer `bun run db:migrate`.
5. Lancer `bun run check-types`.
6. Commit schema + migration + meta ensemble.

## Quand tu modifies des payloads API

1. Modifier Zod dans `packages/shared/src/schemas/*`.
2. Verifier types derives dans `packages/shared/src/types/dto.ts`.
3. Adapter `packages/api` (router/service/repo).
4. Lancer `bun run check-types`.

## Troublshooting (erreurs frequentes)

## `bun: command not found`

Bun n’est pas installe sur la machine.

```bash
curl -fsSL https://bun.sh/install | bash
```

Puis redemarrer le terminal.

## Erreur Docker / DB non accessible

- Verifier Docker Desktop est lance.
- Relancer:

```bash
bun run db:down
bun run db:start
```

- Rejouer migrations:

```bash
bun run db:migrate
```

## TypeScript / routeTree web

Si `apps/web` remonte des erreurs TanStack route tree:

```bash
bun run --cwd apps/web routes:generate
bun run --cwd apps/web check-types
```

## CORS en local

Verifier `apps/server/.env`:

- `CORS_ORIGIN=http://localhost:5173`
- `BETTER_AUTH_URL=http://localhost:3000`

## Références utiles dans le repo

- Architecture packages: [packagesARCH.md](./packagesARCH.md)
- Schema DB checklist: `packages/db/src/DB_CHECKLIST.md`
- Schema metier source: `apps/server/DB.md`
- Turbo pipeline: `turbo.json`
