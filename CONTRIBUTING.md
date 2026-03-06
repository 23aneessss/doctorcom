# Contributing Guide

Ce document fixe les regles de contribution pour garder un repo propre et reduire au maximum les merge conflicts.

## Objectif

- Permettre a l’equipe de travailler en parallele sur les APIs.
- Limiter les changements hors scope.
- Garder des PR petites, relisibles et faciles a merger.

## Règle principale (API module-first)

Pour une feature API standard, tu modifies uniquement le module concerne:

- `packages/api/src/modules/<module>/router.ts`
- `packages/api/src/modules/<module>/service.ts`
- `packages/api/src/modules/<module>/repo.ts`
- optionnel: `packages/api/src/modules/<module>/rules.ts`

Exemple:

- Feature patient => uniquement `packages/api/src/modules/patient/*`

## Quand tu as le droit de toucher d’autres dossiers

Tu peux sortir du dossier module seulement dans ces cas:

1. Changement de payload input/output:
- `packages/shared/src/schemas/*`
- `packages/shared/src/types/dto.ts`

2. Changement de schema base de donnees:
- `packages/db/src/schema/*`
- `packages/db/src/migrations/*`
- `packages/db/src/migrations/meta/*`

3. Changement transversal tRPC/auth/context:
- `packages/api/src/trpc/*`
- `packages/auth/src/index.ts`
- `apps/server/src/index.ts` (montage/boot uniquement)

Hors de ces cas: pas de modif globale.

## Règles anti-merge-conflict (obligatoires)

1. Une PR = un seul objectif fonctionnel.
2. Interdit de faire du reformat massif dans une PR feature.
3. Interdit de modifier un module qui ne t’est pas assigne.
4. Si tu dois toucher `shared` ou `db`, annonce-le avant dans le canal equipe.
5. Commit schema + migration dans le meme commit.
6. Ne pas commiter `node_modules`, `dist`, fichiers temporaires IDE.
7. Eviter de modifier `README.md`, `packagesARCH.md`, configs globales sans besoin reel.

## Convention de branches

Format recommande:

- `feat/<module>-<short-desc>`
- `fix/<module>-<short-desc>`
- `chore/<scope>-<short-desc>`

Exemples:

- `feat/patient-create-procedure`
- `fix/ordonnance-validation`
- `chore/db-add-index-rendez-vous`

## Workflow quotidien

1. Mettre ta branche a jour avant de coder:

```bash
git fetch origin
git rebase origin/main
```

2. Coder dans ton scope module.

3. Valider localement avant push:

```bash
bun run check-types:backend
```

4. Si schema DB modifie:

```bash
bun run db:generate
bun run db:migrate
bun run check-types
```

5. Commit clair et pousse:

```bash
git add .
git commit -m "feat(patient): add create patient procedure"
git push origin <ta-branche>
```

## Checklist PR (avant review)

- [ ] Le scope est limite au module concerne.
- [ ] Pas de fichier global modifie sans justification.
- [ ] `bun run check-types:backend` passe.
- [ ] Si DB touchee: migration generee et commit.
- [ ] Pas de dead code / TODO inutile.
- [ ] Description PR claire (quoi, pourquoi, impact).

## Commandes utiles

Installation:

```bash
bun install
```

Dev:

```bash
bun run dev:server
bun run dev:web
bun run dev
```

Qualite:

```bash
bun run check-types
bun run check-types:backend
```

Base de donnees:

```bash
bun run db:start
bun run db:generate
bun run db:migrate
bun run db:studio
bun run db:stop
bun run db:down
```

## Politique de résolution de conflits

Si conflit:

1. Priorite au schema/contrat le plus recent de la branche cible.
2. Ne pas “deviner” une fusion sur `db`/`shared` sans valider avec le proprietaire du changement.
3. Relancer apres resolution:

```bash
bun run check-types
bun run db:generate
```

## Owners recommandés (pratique equipe)

Recommande pour limiter les collisions:

- `patient`, `consultation`, `ordonnance`, `agenda`, `auth`, `ai`, etc. => 1 owner principal + 1 backup.
- `db` et `shared` => changements plus controles (review obligatoire d’au moins 1 autre dev).

## Références

- Architecture packages: `packagesARCH.md`
- Setup projet: `README.md`
- Source schema metier: `apps/server/DB.md`
