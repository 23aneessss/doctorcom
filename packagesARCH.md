# Packages Architecture (`/packages`)

Ce document explique en detail la couche `packages/` de ce monorepo Bun + Turbo, pour que l’equipe sache exactement ou coder quoi.

## 1) Vision d’ensemble

Le dossier `packages/` contient le **coeur partage** du backend:

- `api`: couche tRPC (routers, context, middlewares, modules placeholders).
- `auth`: configuration Better-Auth (adapteur Drizzle + policy cookies/origins).
- `db`: schema Drizzle, client Postgres, migrations.
- `shared`: contrats partages (types inferes DB, DTO Zod, erreurs applicatives).
- `env`: validation centralisee des variables d’environnement (server/web/native).
- `config`: base de configuration TypeScript partagee.

Le principe est:

- `apps/server` demarre Express.
- `apps/server` consomme `@doctor.com/api`.
- `@doctor.com/api` consomme `@doctor.com/auth`, `@doctor.com/db`, `@doctor.com/shared`.
- `@doctor.com/auth` consomme `@doctor.com/db` + `@doctor.com/env/server`.
- `@doctor.com/shared` consomme `@doctor.com/db/schema` pour aligner Zod/types avec la DB.

## 2) Arbre du dossier `/packages`

Arbre fonctionnel (sources et fichiers importants):

```text
packages/
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── context.ts
│       ├── routers/
│       │   └── index.ts
│       ├── trpc/
│       │   ├── context.ts
│       │   ├── init.ts
│       │   ├── router.ts
│       │   └── middleware/
│       │       ├── auth.ts
│       │       ├── audit.ts
│       │       ├── errors.ts
│       │       └── validate.ts
│       ├── infrastructure/
│       │   ├── pdf/index.ts
│       │   ├── scheduler/index.ts
│       │   └── storage/index.ts
│       └── modules/
│           ├── agenda/{router.ts,service.ts,repo.ts}
│           ├── ai/{router.ts,service.ts,repo.ts}
│           ├── aide/{router.ts,service.ts}
│           ├── auth/{better-auth.ts,router.ts,service.ts,repo.ts}
│           ├── consultation/{router.ts,service.ts,repo.ts}
│           ├── email/{router.ts,service.ts}
│           ├── export/{router.ts,service.ts}
│           ├── ordonnance/{router.ts,service.ts,repo.ts,rules.ts}
│           ├── patient/{router.ts,service.ts,repo.ts}
│           └── validation/{router.ts,service.ts}
├── auth/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts
├── config/
│   ├── package.json
│   └── tsconfig.base.json
├── db/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── docker-compose.yml
│   └── src/
│       ├── index.ts
│       ├── DB_CHECKLIST.md
│       ├── schema/
│       │   ├── index.ts
│       │   ├── enums.ts
│       │   ├── utilisateurs.ts
│       │   ├── patients.ts
│       │   ├── suivi.ts
│       │   ├── traitements.ts
│       │   ├── documents.ts
│       │   └── auth.ts
│       └── migrations/
│           ├── .gitkeep
│           ├── 0000_opposite_wong.sql
│           ├── 0001_right_marrow.sql
│           ├── 0002_complete_songbird.sql
│           └── meta/
│               ├── _journal.json
│               ├── 0000_snapshot.json
│               ├── 0001_snapshot.json
│               └── 0002_snapshot.json
├── env/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts
│       ├── web.ts
│       └── native.ts
└── shared/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── errors/index.ts
        ├── types/
        │   ├── index.ts
        │   ├── db.ts
        │   └── dto.ts
        └── schemas/
            ├── index.ts
            ├── common.ts
            ├── utilisateurs.ts
            ├── patients.ts
            ├── suivi.ts
            ├── rendez-vous.ts
            ├── ordonnance.ts
            └── documents-patient.ts
```

Note:

- Les dossiers `node_modules/`, `dist/`, `.turbo/` existent aussi localement mais sont des artefacts d’installation/build, pas de l’architecture source.

## 3) Détail package par package

## `packages/config`

Role:

- Fournit la base TypeScript commune pour tout le monorepo.

Fichiers:

- `tsconfig.base.json`: options TS strictes (`strict`, `moduleResolution: bundler`, `noUnusedLocals`, etc.).
- `package.json`: package interne prive.

Impact equipe:

- Evite des comportements TS differents entre packages.
- Toute variation d’options TS doit passer par ce package pour rester coherente.

---

## `packages/env`

Role:

- Centralise la validation des variables d’environnement via Zod + `@t3-oss/env-core`.
- Separer par runtime cible: serveur, web, native.

Fichiers:

- `src/server.ts`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `NODE_ENV`.
- `src/web.ts`: variables client Vite (`VITE_*`).
- `src/native.ts`: variables Expo (`EXPO_PUBLIC_*`).

Impact equipe:

- Si une variable manque ou est invalide, erreur explicite au demarrage.
- Pas de lecture “libre” de `process.env` dans le code metier: on passe par `@doctor.com/env/...`.

---

## `packages/db`

Role:

- Source unique de la structure PostgreSQL (tables, enums, FK, index).
- Gestion des migrations Drizzle.
- Client DB partage (`db`, `pool`, helper transaction `withTx`).

Fichiers cle:

- `src/index.ts`:
  - cree un `Pool` Postgres avec `DATABASE_URL`;
  - expose `db` (Drizzle);
  - expose `withTx` pour transactions type-safe.
- `drizzle.config.ts`:
  - schema: `./src/schema/**/*.ts` (tous les fichiers schema sont pris en compte);
  - output migrations: `./src/migrations`.
- `src/schema/*.ts`:
  - split par domaines metier pour lisibilite et collaboration.
- `src/schema/auth.ts`:
  - tables Better-Auth (`user`, `session`, `account`, `verification`).
- `src/migrations/*` + `src/migrations/meta/*`:
  - SQL versionne + snapshots Drizzle.
- `src/DB_CHECKLIST.md`:
  - checklist de verification table/colonne/FK/enums vs schema fonctionnel.
- `docker-compose.yml`:
  - Postgres local pour dev.

Pourquoi le split de schema est important:

- un fichier unique devient vite difficile a maintenir;
- split par domaines reduit les conflits git;
- `schema/index.ts` reste l’entrypoint stable (les autres packages continuent d’importer `@doctor.com/db/schema` sans changement).

---

## `packages/shared`

Role:

- Definir le **contrat commun** entre API et clients:
  - Types DB inferes depuis Drizzle.
  - DTO de create/update via Zod.
  - Erreurs applicatives normalisees.

Sous-dossiers:

- `src/types/db.ts`:
  - `InferSelectModel` / `InferInsertModel` pour toutes les tables metier.
  - garantit que les types suivent automatiquement le schema DB.
- `src/types/dto.ts`:
  - types TypeScript derives des schemas Zod (create/update).
- `src/schemas/common.ts`:
  - briques de validation reutilisables (uuid, date ISO, heure, enums, numeric, etc.).
- `src/schemas/*.ts`:
  - schemas DTO par domaine (`utilisateurs`, `patients`, `suivi`, `rendez-vous`, `ordonnance`, `documents-patient`).
- `src/errors/index.ts`:
  - `ERROR_CODES` + mapping `ERROR_MESSAGES` en francais.

Impact equipe:

- Tu changes une contrainte de payload une seule fois dans `shared/schemas/*`.
- API et front se synchronisent sur le meme contrat.

---

## `packages/auth`

Role:

- Encapsule Better-Auth (configuration centralisee) pour eviter de disperser la logique auth.

Fichier cle:

- `src/index.ts`:
  - initialise Better-Auth avec Drizzle adapter (`@doctor.com/db/schema/auth`);
  - configure `trustedOrigins`;
  - cookie policy dependante de l’environnement:
    - `secure: true` en production;
    - `secure: false` en dev.
  - expose `betterAuthConfigPlaceholder` + instance `auth`.

Impact equipe:

- Le reste du backend consomme `@doctor.com/auth`, sans dupliquer la configuration Better-Auth.
- Tu peux enrichir providers/flows plus tard sans casser les modules API.

---

## `packages/api`

Role:

- Couche tRPC backend partagee:
  - initialisation tRPC;
  - context request (`db`, session auth, request id);
  - agrégation des routers par module;
  - structure modules `router/service/repo` prete pour l’implementation.

Points d’entrée:

- `src/index.ts`:
  - re-export public du package (`context`, routers, init tRPC).
- `src/context.ts`:
  - alias/export du context tRPC.
- `src/trpc/init.ts`:
  - `createTRPCRouter`, `publicProcedure`, `protectedProcedure`.
- `src/trpc/context.ts`:
  - cree le context avec session Better-Auth + DB.
- `src/trpc/router.ts`:
  - construit `appRouter` en composant les routers modules.

Middlewares:

- `middleware/auth.ts`: controle auth.
- `middleware/audit.ts`: placeholder audit log.
- `middleware/validate.ts`: placeholder validation pipeline.
- `middleware/errors.ts`: resolution de message d’erreur applicatif.

Modules metier:

- Dossiers `modules/*` suivent un pattern stable:
  - `router.ts`: surface tRPC du module (actuellement vide/scaffold).
  - `service.ts`: orchestration metier (placeholder).
  - `repo.ts`: acces persistence (placeholder si besoin).
- Modules actuels: `auth`, `patient`, `consultation`, `ordonnance`, `agenda`, `export`, `aide`, `validation`, `ai`, `email`.

Infrastructure:

- `infrastructure/pdf`, `storage`, `scheduler`: adaptateurs placeholders non metier.

Impact equipe:

- Architecture propre en couches (router -> service -> repo).
- Vos prochains commits peuvent ajouter la logique sans reorganiser le repo.

## 4) Contrats d’import / boundaries

Regle pratique recommandee:

- `apps/*` importent les packages, pas les chemins internes entre apps.
- `api` n’implemente pas le schema SQL: il consomme `db` et `shared`.
- `shared` ne contient pas de logique I/O (pas d’appel DB direct), seulement contrats/types/validation.
- `db` reste la seule source de verite pour la structure relationnelle.

Exemples d’imports corrects:

- `import { db } from "@doctor.com/db"`
- `import { appRouter } from "@doctor.com/api/routers/index"`
- `import { createPatientSchema } from "@doctor.com/shared/schemas"`
- `import { env } from "@doctor.com/env/server"`

## 5) Cycle de developpement type (backend)

1. Tu modifies `packages/db/src/schema/*`.
2. Tu lances `bun run db:generate` puis `bun run db:migrate`.
3. Les types DB et enums sont automatiquement refleches dans `@doctor.com/shared`.
4. Tu ajustes les DTO Zod dans `packages/shared/src/schemas/*` si le payload change.
5. Tu implementes ensuite `repo/service/router` dans `packages/api/src/modules/*`.
6. Tu valides avec `bun run check-types`.

## 6) Ce qui est “scaffold” vs “production-ready”

Deja solide:

- structure monorepo;
- decoupage packages;
- schema DB + migrations;
- contrats de types/validation;
- config auth/env centralisee.

Encore placeholder (normal pour cette phase):

- procedures tRPC metier dans les routers modules;
- logique service/repository detaillee;
- adaptateurs infra (`pdf`, `scheduler`, `storage`) definitifs.

## 7) Pourquoi cette architecture aide l’equipe

Benefices concrets pour ton equipe:

- comprehension rapide: chaque responsabilite a un package clair;
- collaboration parallele: DB/Auth/API/DTO peuvent avancer en meme temps;
- moins de regressions: types et schemas centralises evitent les divergences;
- evolutivite: tu peux grossir le backend sans refaire la structure.

En pratique, pour le commit “backend initialized”, cette architecture est propre et exploitable par plusieurs devs en parallele.
