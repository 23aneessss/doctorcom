# Team Context

Ce document resume le contexte technique actuel du repo pour qu'un coequipier puisse reprendre le projet sans l'historique complet de discussion.

## 1. But du repo

Ce projet est un monorepo Bun + Turborepo pour une application de gestion de cabinet medical.

Stack principale:

- Bun
- TypeScript
- Express
- tRPC
- Drizzle ORM
- PostgreSQL
- Better-Auth
- TanStack Router cote web

Le backend suit une architecture modulaire orientee domaine.

## 2. Organisation generale

Le repo est structure comme suit:

- `apps/server`
  - runtime serveur Express
  - monte Better-Auth et tRPC
  - ne contient pas la logique metier
- `apps/web`
  - client web
- `packages/api`
  - coeur backend tRPC
  - modules metier
  - context tRPC
  - router racine
  - infrastructure technique backend
- `packages/db`
  - schema Drizzle
  - client PostgreSQL
  - migrations
- `packages/auth`
  - configuration Better-Auth
- `packages/shared`
  - schemas Zod partages
  - types derives
  - erreurs applicatives

Decision importante:

- le backend metier vit dans `packages/api`
- `apps/server` est juste le point d'entree runtime

## 3. Architecture backend retenue

Dans `packages/api/src`, la structure utile est:

- `modules/`
  - un dossier par domaine metier
  - pattern strict: `repo.ts`, `service.ts`, `router.ts`
- `trpc/`
  - init tRPC
  - context
  - middlewares
  - router racine
- `infrastructure/`
  - couches techniques non metier
- `lib/validation/`
  - validation stateless partagee
- `utils/`
  - fonctions utilitaires pures

Separation des responsabilites:

- `repo.ts` = acces DB uniquement
- `service.ts` = logique metier
- `router.ts` = endpoints tRPC + Zod

Le router ne doit jamais taper la DB directement.

## 4. Decisions d'architecture prises pendant le travail

### 4.1 Patient comme aggregate root

Le patient reste l'entite centrale.

Les sous-domaines lies au patient ont ete separes en modules independants:

- `consultation`
- `agenda`
- `medical-history`
- `vaccination`
- `travel`
- `documents`
- `treatment`

Regle voulue:

- les autres modules peuvent dependre du patient
- `patient` ne doit pas dependre des autres modules

### 4.2 Modules retires

Les anciens modules backend suivants ne font plus partie des modules metier:

- `aide`
- `email`
- `validation`

Etat actuel:

- `aide` est considere comme concern frontend, pas backend
- `email` a ete deplace conceptuellement vers `packages/api/src/infrastructure/email`
- `validation` a ete deplace conceptuellement vers `packages/api/src/lib/validation`

### 4.3 Infrastructure technique

Les dossiers techniques backend a garder hors `modules/`:

- `infrastructure/storage`
  - pour le stockage de fichiers
- `infrastructure/pdf`
  - pour la generation PDF
- `infrastructure/scheduler`
  - pour les jobs programmes, rappels, cron, queue plus tard
- `infrastructure/email`
  - pour un futur provider d'email

Ces dossiers ne representent pas des domaines metier. Ils representent des details techniques d'implementation.

## 5. Etat actuel des modules backend

Modules tRPC enregistres dans le router racine:

- `auth`
- `patient`
- `consultation`
- `agenda`
- `medicalHistory`
- `vaccination`
- `travel`
- `documents`
- `treatment`
- `ordonnance`
- `export`
- `ai`

Modules deja implementes pendant cette phase:

- `auth`
- `agenda`
- `consultation`
- `travel`
- `treatment`
- `vaccination`
- `medical-history`

Modules a considerer encore comme scaffold / placeholder tant qu'ils ne sont pas verifies davantage:

- `patient`
- `documents`
- `ordonnance`
- `export`
- `ai`

## 6. Etat de l'auth

Authentification retenue:

- Better-Auth est conserve pour la gestion des sessions/cookies
- signup email/password est desactive
- l'utilisateur initial medecin est bootstrappe en SQL manuel

Points utiles:

- config Better-Auth: `packages/auth/src/index.ts`
- routes auth metier tRPC: `packages/api/src/modules/auth/*`
- script bootstrap SQL: `packages/api/src/modules/auth/sql/bootstrap_medecin.sql`

Convention importante:

- SQL brut autorise uniquement pour le bootstrap manuel de l'utilisateur initial
- dans le code backend applicatif, acces DB via Drizzle ORM uniquement

## 7. Etat de la base de donnees

Le schema Drizzle est split par domaine pour reduire les conflits git:

- `packages/db/src/schema/utilisateurs.ts`
- `packages/db/src/schema/patients.ts`
- `packages/db/src/schema/suivi.ts`
- `packages/db/src/schema/traitements.ts`
- `packages/db/src/schema/documents.ts`
- `packages/db/src/schema/auth.ts`
- `packages/db/src/schema/enums.ts`
- `packages/db/src/schema/index.ts`

Le schema DB a ete aligne sur le diagramme metier fourni pendant la discussion.

Important:

- snake_case respecte cote DB
- enums Postgres utilises
- Better-Auth a ses propres tables dans `schema/auth.ts`

## 8. Etat qualite actuel

Au moment de ce resume:

- `bun run check-types` passe
- `bun run --cwd packages/api check-types` passe
- `bun run --cwd apps/server check-types` passe

Donc le repo est dans un etat compilable.

## 9. Comment tester le backend

Le backend expose:

- Better-Auth: `/api/auth/*`
- tRPC: `/trpc`

Convention tRPC de ce repo:

- query simple:
  - `GET /trpc/module.procedure?input={...}`
- mutation simple:
  - `POST /trpc/module.procedure`
  - body JSON brut

Exemples:

- `GET /trpc/agenda.getRDVParDate?input={"date":"2026-03-08"}`
- `POST /trpc/treatment.startTreatment`

Pendant la discussion, plusieurs collections Postman JSON ont ete generees manuellement pour tester:

- auth
- agenda
- treatment
- vaccination
- medical-history

Elles ne sont pas forcement committees dans le repo, mais la methode de test est stabilisee.

## 10. Commandes principales du projet

Depuis la racine:

```bash
bun install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Base de donnees:

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```

Serveur:

```bash
bun run dev:server
```

Web:

```bash
bun run dev:web
```

Verification types:

```bash
bun run check-types
bun run check-types:backend
```

## 11. Raison d'etre de Turborepo

Turborepo ne contient pas la logique metier.
Il sert a orchestrer les scripts des workspaces du monorepo.

Exemples:

- `bun run dev:server` -> lance le script `dev` du workspace `server`
- `bun run db:migrate` -> lance le script `db:migrate` du workspace `@doctor.com/db`
- `bun run check-types` -> lance le typecheck sur tous les workspaces qui definissent `check-types`

Donc:

- `bun` = runtime/package manager
- `turbo` = orchestrateur monorepo
- Better-T-Stack = starter/template de depart, pas le runtime quotidien

## 12. Conventions de travail equipe

Pour limiter les merge conflicts, la strategie retenue pendant la discussion etait:

- quand un module est en cours de dev, on essaye de modifier seulement son dossier
- eviter de toucher `trpc/router.ts` sauf si on ajoute vraiment un nouveau module
- garder les couches techniques hors `modules/`
- garder la logique metier hors `apps/server`

Exemple:

- si tu travailles sur `travel`, idealement tu touches seulement `packages/api/src/modules/travel/*`

## 13. Ce qu'un nouveau developpeur doit lire en premier

Ordre conseille:

1. `README.md`
2. `packagesARCH.md`
3. `packages/api/src/trpc/router.ts`
4. `packages/api/src/trpc/context.ts`
5. `packages/db/src/schema/*`
6. un module deja implemente complet, par exemple:
   - `packages/api/src/modules/agenda/*`
   - ou `packages/api/src/modules/consultation/*`
   - ou `packages/api/src/modules/medical-history/*`

## 14. Point important pour Codex / IA / onboarding

Si un agent IA ou un coequipier reprend le repo, il doit savoir:

- le backend metier est dans `packages/api`, pas dans `apps/server`
- `apps/server` sert a booter Express + Better-Auth + tRPC
- les modules backend utilisent le pattern `repo/service/router`
- les acces DB applicatifs doivent passer par Drizzle ORM
- `aide` n'est plus un module backend
- `email` et `validation` ne sont plus des modules metier backend
- `storage`, `pdf`, `scheduler`, `email` sont des details techniques d'infrastructure

## 15. Resume ultra court

Le repo est un monorepo Bun/Turbo.
Le vrai backend metier est dans `packages/api`.
Le serveur Express est dans `apps/server`.
La DB est geree par Drizzle dans `packages/db`.
L'auth est geree par Better-Auth dans `packages/auth`.
Les modules backend deja bien avances sont `auth`, `agenda`, `consultation`, `travel`, `treatment`, `vaccination`, `medical-history`.
`aide` est frontend-only.
`email` et `validation` ont quitte `modules/` pour devenir des couches techniques/utilitaires.
