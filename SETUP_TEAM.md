# SETUP_TEAM.md

Guide de setup equipe pour `doctor.com`, specialement pour les nouvelles machines Windows.

L'objectif de ce document est simple :

- standardiser l'environnement local de toute l'equipe
- eviter les installs cassees avec `bun install`
- permettre a un coequipier humain ou a un agent Codex de setup le projet sans deviner

Ce document est la reference pratique pour lancer le repo.

---

## 1. Regles de standardisation

Pour ce repo, l'equipe doit suivre ces regles sans exception :

1. Utiliser **Bun 1.2.20**
2. Lancer `bun install` **uniquement a la racine du repo**
3. Si une install a deja casse, faire un **clean install complet**
4. Copier les `.env.example` avant de lancer les apps
5. Ne jamais "reparer" un souci de monorepo en installant des paquets a la main dans `apps/web`, `apps/server`, `apps/native` ou `packages/*`

Important :

- le monorepo utilise `workspaces`, `workspace:*` et `catalog:`
- si la version de Bun n'est pas la bonne, `bun install` peut se comporter bizarrement

La version attendue est deja pinnee dans [package.json](./package.json) :

```json
"packageManager": "bun@1.2.20"
```

---

## 2. Stack du repo

Le projet est un monorepo Bun + Turborepo :

- `apps/web` : frontend web
- `apps/server` : backend Express + tRPC + Better Auth
- `apps/native` : app Expo/React Native
- `packages/api` : logique tRPC / modules backend
- `packages/db` : schemas Drizzle / migrations
- `packages/auth` : auth
- `packages/shared` : types / schemas partages

Pour le web, il faut en general lancer :

- backend
- web
- PostgreSQL

Pour certaines features documents/storage :

- MinIO

---

## 3. Prerequis Windows

Chaque coequipier Windows doit avoir :

1. **Git**
2. **Bun 1.2.20**
3. **PostgreSQL** local
4. **Docker Desktop** si on utilise MinIO
5. Un terminal correct :
   - PowerShell
   - Windows Terminal
   - ou Git Bash

Recommande :

- utiliser **PowerShell** ou **Windows Terminal**
- ne pas melanger trop d'environnements differents sur la meme machine

---

## 4. Installer Bun 1.2.20 sur Windows

### Option recommandee

Installer Bun depuis l'installateur officiel Windows, puis verifier la version.

Documentation officielle :

- [Bun installation](https://bun.sh/docs/installation)

Ensuite verifier :

```powershell
bun --version
```

Resultat attendu :

```powershell
1.2.20
```

### Si la version est mauvaise

Si le resultat n'est pas `1.2.20`, il faut mettre Bun a niveau avant toute autre chose.

Le repo n'est pas supporte si chacun utilise une version differente.

### Verifier quel Bun est utilise

```powershell
where.exe bun
```

Tu veux eviter les cas ou :

- un Bun systeme ancien est pris par erreur
- un autre Bun installe precedemment prend le dessus dans le PATH

---

## 5. Recuperer le projet

Cloner le repo ou recuperer la branche souhaitee, puis se placer **a la racine**.

Exemple :

```powershell
cd C:\Users\<USER>\Documents\doctor.com
```

Tres important :

- ne pas se placer dans `apps/web`
- ne pas se placer dans `apps/server`
- ne pas lancer `bun install` dans un sous-dossier

La seule bonne place pour installer est la racine :

```powershell
C:\...\doctor.com
```

---

## 6. Installation normale

Depuis la racine du repo :

```powershell
bun install
```

Si cette commande se termine correctement, continuer directement a l'etape des `.env`.

---

## 7. Clean install complet si `bun install` casse

Si un coequipier a deja tente une install foireuse, il faut repartir proprement.

Depuis la racine du repo :

### PowerShell

```powershell
Remove-Item -Recurse -Force node_modules
Get-ChildItem apps -Directory | ForEach-Object {
  $nm = Join-Path $_.FullName "node_modules"
  if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
}
Get-ChildItem packages -Directory | ForEach-Object {
  $nm = Join-Path $_.FullName "node_modules"
  if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
}
bun pm cache rm
bun install
```

### Si vous utilisez Git Bash

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
bun pm cache rm
bun install
```

Notes :

- ne supprime pas `bun.lock`
- le but est de nettoyer les `node_modules` et le cache, pas de changer la resolution du repo

---

## 8. Variables d'environnement

Depuis la racine du repo, copier les fichiers `.env.example`.

### PowerShell

```powershell
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/native/.env.example apps/native/.env
```

Au minimum, pour faire tourner le web :

```powershell
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Variables importantes :

### `apps/server/.env`

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/doctor_com`
- `BETTER_AUTH_SECRET=...`
- `BETTER_AUTH_URL=http://localhost:3000`
- `CORS_ORIGIN=http://localhost:3001`

### `apps/web/.env`

- `VITE_SERVER_URL=http://localhost:3000`

### `apps/native/.env`

- l'URL serveur doit etre adaptee a la machine / au reseau si on teste sur un vrai mobile

---

## 9. PostgreSQL sur Windows

Le backend a besoin de PostgreSQL local.

Verifier d'abord :

```powershell
psql --version
```

Puis verifier si PostgreSQL repond :

```powershell
pg_isready -h localhost -p 5432
```

Si PostgreSQL ne tourne pas :

- le demarrer depuis `Services`
- ou via l'installation PostgreSQL locale

Une fois la DB disponible :

```powershell
bun run db:migrate
```

Si besoin :

```powershell
bun run db:generate
bun run db:migrate
```

---

## 10. Seed de base

Selon le besoin du coequipier :

### Seed principal

```powershell
bun run db:seed
```

### Modeles pre-remplis

```powershell
bun run db:seed:pre-remplis
```

### Base medicaments

```powershell
bun run medications-db:seed
```

### Donnees de demo specifiques

```powershell
bun run db:seed:demo-female
bun run db:seed:mobile-demo
```

Si le but est juste de lancer le web rapidement, on peut faire au minimum :

```powershell
bun run db:migrate
bun run db:seed
bun run db:seed:pre-remplis
```

---

## 11. MinIO si les documents / storage sont utilises

Si une feature depend du stockage de documents :

```powershell
bun run minio:up
```

Cela suppose que Docker Desktop est installe et lance.

URLs utiles :

- API S3 : `http://localhost:9000`
- Console : `http://localhost:9001`

---

## 12. Commandes de lancement

Depuis la racine du repo.

### Backend

```powershell
bun run dev:server
```

### Web

Dans un autre terminal :

```powershell
bun run dev:web
```

### Native

```powershell
bun run dev:native
```

### Lancer plusieurs workspaces

```powershell
bun run dev
```

URLs utiles :

- backend : `http://localhost:3000`
- web : `http://localhost:3001`
- tRPC : `http://localhost:3000/trpc`

---

## 13. Commandes utiles de verification

### Verifier Bun

```powershell
bun --version
where.exe bun
```

### Verifier typecheck

```powershell
bun run check-types
```

### Verifier backend seulement

```powershell
bun run check-types:backend
```

### Verifier build web

```powershell
bun run --cwd apps/web build
```

---

## 14. Regles a imposer a toute l'equipe

Ces regles doivent etre considerees comme obligatoires.

### A faire

- utiliser `bun 1.2.20`
- lancer `bun install` seulement a la racine
- copier les `.env.example`
- lancer PostgreSQL avant le backend
- faire un clean install si la machine a deja une install cassee

### A ne jamais faire

- `bun install` dans `apps/web`
- `bun install` dans `apps/server`
- installer des packages manuellement dans un sous-workspace pour "reparer"
- melanger plusieurs versions de Bun entre coequipiers
- committer `node_modules`, `dist`, ou fichiers temporaires

---

## 15. Diagnostic rapide si un coequipier dit "le projet ne marche pas"

Lui faire executer, dans cet ordre :

```powershell
bun --version
where.exe bun
cd C:\chemin\vers\doctor.com
bun install
```

Si `bun install` casse :

```powershell
Remove-Item -Recurse -Force node_modules
Get-ChildItem apps -Directory | ForEach-Object {
  $nm = Join-Path $_.FullName "node_modules"
  if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
}
Get-ChildItem packages -Directory | ForEach-Object {
  $nm = Join-Path $_.FullName "node_modules"
  if (Test-Path $nm) { Remove-Item -Recurse -Force $nm }
}
bun pm cache rm
bun install
```

Puis :

```powershell
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/web/.env.example apps/web/.env
bun run db:migrate
bun run dev:server
bun run dev:web
```

---

## 16. Instructions courtes pour un agent Codex

Tu peux donner ce repo + ce brief a un agent Codex :

> Projet monorepo Bun/Turborepo. Utiliser strictement Bun 1.2.20. Toujours lancer `bun install` a la racine du repo, jamais dans les sous-dossiers. Si l'installation casse, supprimer tous les `node_modules` racine/apps/packages, nettoyer le cache Bun, puis relancer `bun install`. Copier les `.env.example`, lancer PostgreSQL local, puis `bun run db:migrate`, `bun run dev:server` et `bun run dev:web`. Ne pas modifier la structure globale du monorepo juste pour "reparer" l'install.

---

## 17. Checklist finale de setup reussi

Le setup est considere OK si :

- [ ] `bun --version` retourne `1.2.20`
- [ ] `bun install` passe a la racine
- [ ] `apps/server/.env` existe
- [ ] `apps/web/.env` existe
- [ ] PostgreSQL repond
- [ ] `bun run db:migrate` passe
- [ ] `bun run dev:server` demarre
- [ ] `bun run dev:web` demarre
- [ ] le web est accessible sur `http://localhost:3001`

---

## 18. Point important pour l'equipe

Si un nouveau coequipier n'arrive pas a lancer le projet, le premier reflexe ne doit pas etre :

- installer des dependances a la main
- changer les versions dans les `package.json`
- remplacer Bun par npm/pnpm/yarn

Le premier reflexe doit etre :

1. verifier la version de Bun
2. verifier qu'il est a la racine
3. faire un clean install
4. verifier les `.env`
5. verifier PostgreSQL

Si ces 5 points sont bons, alors on debugge autre chose.
