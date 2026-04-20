# Frontend Agent Context — doctor.com

Ce document est un **handoff complet pour un agent de code** qui doit travailler sur le **frontend web** et l’**intégration de nouvelles pages** dans ce repo.

Objectif :

- donner assez de contexte pour être productif rapidement ;
- éviter de casser l’architecture existante ;
- **réduire au maximum les merge conflicts** entre coéquipiers.

Le repo est un monorepo Bun + Turborepo.  
Le chemin réel actuel du repo est :

- `/Users/mac/Documents/doctor.com`

Le chemin `/Users/mac/Desktop/doctor.com` peut être un symlink de compatibilité.

---

## 1. Résumé du projet

`doctor.com` est une plateforme de gestion de cabinet médical avec :

- backend centralisé en tRPC/Express ;
- frontend web React ;
- frontend mobile Expo ;
- modules métier patients / agenda / traitements / ordonnances / documents / vaccins / voyages ;
- modules AI pour :
  - hypothèse diagnostique,
  - recommandation d’ordonnance,
  - QnA dossier patient,
  - QnA médicaments,
  - détection d’anomalies / documents.

Le **frontend web** est déjà assez avancé, surtout autour du **dossier patient**.

Le coéquipier visé par ce document va surtout travailler sur :

- création de pages web,
- intégration UI,
- raccordement au backend tRPC existant,
- amélioration frontend sans casser les flows déjà branchés.

---

## 2. Stack frontend web

Le frontend web utilise :

- React 19
- Vite
- TanStack Router
- TanStack Query
- tRPC client
- Better Auth
- Motion
- Tailwind + styles custom
- Lucide + Phosphor icons
- Sonner pour les toasts

Fichier package utile :

- [apps/web/package.json](/Users/mac/Desktop/doctor.com/apps/web/package.json)

Scripts frontend utiles :

```bash
cd /Users/mac/Desktop/doctor.com
bun run dev:web
```

```bash
cd /Users/mac/Desktop/doctor.com/apps/web
bun run dev
```

Typecheck web :

```bash
bunx tsc --noEmit -p /Users/mac/Desktop/doctor.com/apps/web/tsconfig.json
```

Etat actuel connu du typecheck web :

- il reste **3 erreurs déjà connues**, hors travail métier courant :
  - `apps/web/src/routes/dashboard.tsx`
  - `packages/api/src/infrastructure/storage/index.ts`
  - `packages/api/src/modules/documents/service.ts`

Donc si l’agent touche une page frontend métier et que ces 3 erreurs réapparaissent, ce n’est **pas forcément sa faute**.

---

## 3. Architecture générale du repo

### Apps

- `apps/web` = frontend web
- `apps/native` = mobile Expo
- `apps/server` = runtime serveur Express

### Packages

- `packages/api` = backend métier tRPC
- `packages/db` = schema Drizzle + migrations
- `packages/auth` = Better Auth
- `packages/shared` = types/schemas partagés
- `packages/env` = validation des variables d’environnement

Important :

- la logique métier backend **ne vit pas** dans `apps/server`
- elle vit dans `packages/api`

---

## 4. Structure frontend web importante

### Racine de l’app

- [apps/web/src/main.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/main.tsx)
- [apps/web/src/routes/__root.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/__root.tsx)

Le root contient :

- `ThemeProvider`
- `Outlet`
- `GlobalAIAssistant`
- `Toaster`
- devtools conditionnels

### tRPC client

- [apps/web/src/utils/trpc.ts](/Users/mac/Desktop/doctor.com/apps/web/src/utils/trpc.ts)

Le web parle au backend via :

- `${env.VITE_SERVER_URL}/trpc`

avec :

- `credentials: "include"`

### Better Auth client

- [apps/web/src/lib/auth-client.ts](/Users/mac/Desktop/doctor.com/apps/web/src/lib/auth-client.ts)

### Sidebar

- [apps/web/src/components/sidebar.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/sidebar.tsx)

La sidebar est **globale** et constitue un point chaud si plusieurs personnes y touchent en même temps.

### AI Assistant global

- [apps/web/src/components/ai-assistant/AIAssistantPanel.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/ai-assistant/AIAssistantPanel.tsx)

Ce fichier est un autre **point chaud**.

Il contient :

- le panel assistant global,
- les actions AI,
- le chat libre,
- les modals de résultat hypothèse/ordonnance,
- le parsing/rendu des réponses AI.

Si quelqu’un travaille sur le panel AI, il vaut mieux éviter que quelqu’un d’autre modifie ce même fichier en parallèle.

---

## 5. Organisation des routes web

Les routes principales sont dans :

- `apps/web/src/routes`

Routes top-level existantes :

- `index.tsx`
- `dashboard.tsx`
- `login.tsx`
- `agenda/*`
- `patients/*`
- `ordonnance/*`
- `medicament/*`
- `parametres/*`
- `aide/*`

### Dossier patient

Le vrai cœur du frontend est le layout patient :

- [apps/web/src/routes/patients.$id.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id.tsx)

Cette page sert de **shell** pour le dossier patient :

- charge le patient,
- affiche le header fiche patient,
- affiche les tabs,
- gère les popups via événements,
- contient l’`Outlet`.

Sous-pages patient :

- [apps/web/src/routes/patients.$id/general.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/general.tsx)
- [apps/web/src/routes/patients.$id/suivi.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/suivi.tsx)
- [apps/web/src/routes/patients.$id/antecedent.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/antecedent.tsx)
- [apps/web/src/routes/patients.$id/traitement.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/traitement.tsx)
- [apps/web/src/routes/patients.$id/document.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/document.tsx)
- [apps/web/src/routes/patients.$id/vaccination.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/vaccination.tsx)
- [apps/web/src/routes/patients.$id/sante-feminine.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/sante-feminine.tsx)
- [apps/web/src/routes/patients.$id/info-sociale.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/info-sociale.tsx)
- [apps/web/src/routes/patients.$id/voyage.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/voyage.tsx)

### Popups patient

Les popups sont centralisés dans :

- `apps/web/src/routes/patients.$id/popups/*`

Exemples :

- `nouveau-suivi.tsx`
- `nouvelle-consultation.tsx`
- `nouvelle-ordonnance.tsx`
- `ajouter-traitement.tsx`
- `nouvel-antecedent-personnel.tsx`
- `nouveau-document-patient.tsx`
- etc.

Cette structure aide beaucoup à **isoler les changements**.

---

## 6. Conventions frontend importantes

### 6.1 Principe général

Quand tu ajoutes une nouvelle page ou une nouvelle UI :

- garde le shell global en place ;
- ajoute la logique dans le fichier de route concerné ;
- ajoute les composants/popup spécifiques dans des fichiers dédiés ;
- évite de surcharger `patients.$id.tsx` si ce n’est pas nécessaire.

### 6.2 Route = ownership naturel

Pour éviter les merge conflicts :

- une personne = une zone de route
- idéalement :
  - `patients.$id/suivi.tsx` = ownership séparé
  - `patients.$id/document.tsx` = ownership séparé
  - `patients.$id/traitement.tsx` = ownership séparé
  - `agenda/*` = ownership séparé
  - `medicament/*` = ownership séparé

### 6.3 Quand éviter de toucher un fichier partagé

Fichiers à ne modifier que si nécessaire :

- [apps/web/src/components/sidebar.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/sidebar.tsx)
- [apps/web/src/components/ai-assistant/AIAssistantPanel.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/ai-assistant/AIAssistantPanel.tsx)
- [apps/web/src/routes/patients.$id.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id.tsx)
- [apps/web/src/utils/trpc.ts](/Users/mac/Desktop/doctor.com/apps/web/src/utils/trpc.ts)

Ces fichiers sont souvent touchés par tout le monde.

### 6.4 Stratégie anti-merge-conflict

Recommandation concrète :

- créer les nouvelles vues dans leur propre fichier de route ;
- créer les sous-composants dans leur propre fichier ;
- créer les nouveaux popups dans `popups/` ;
- éviter les gros refactors transverses ;
- éviter de reformatter des gros fichiers entiers “gratuitement”.

Si une intégration nécessite de toucher un fichier partagé, garder la modif :

- petite,
- ciblée,
- locale,
- facile à cherry-pick.

---

## 7. Comment le dossier patient est organisé

Le layout patient :

- charge les données,
- affiche les grandes cartes d’identité patient,
- gère les tabs,
- gère l’ouverture des popups via des `CustomEvent`.

### Popup event bus

Le pattern utilisé est :

- `window.dispatchEvent(new CustomEvent("patient-popup-open", { detail: ... }))`

Le layout patient écoute cet événement et ouvre le bon popup.

Donc si le coéquipier veut ouvrir un popup depuis une sous-page :

- il n’a **pas** besoin de recréer tout le state popup ;
- il peut réutiliser ce mécanisme.

Ce pattern est très utile pour limiter les conflits car :

- le state central popup reste dans `patients.$id.tsx`,
- la page enfant peut juste déclencher un événement.

---

## 8. Backend que le frontend réutilise

Le frontend web consomme surtout les routers tRPC suivants :

- `patient`
- `consultation`
- `agenda`
- `ordonnance`
- `medicaments`
- `documents`
- `treatment`
- `vaccination`
- `travel`
- `ai`

Router racine :

- [packages/api/src/trpc/router.ts](/Users/mac/Desktop/doctor.com/packages/api/src/trpc/router.ts)

Routers métier importants :

- [packages/api/src/modules/patient/router.ts](/Users/mac/Desktop/doctor.com/packages/api/src/modules/patient/router.ts)
- [packages/api/src/modules/consultation/router.ts](/Users/mac/Desktop/doctor.com/packages/api/src/modules/consultation/router.ts)
- [packages/api/src/modules/ordonnance/router.ts](/Users/mac/Desktop/doctor.com/packages/api/src/modules/ordonnance/router.ts)
- [packages/api/src/modules/medicaments/router.ts](/Users/mac/Desktop/doctor.com/packages/api/src/modules/medicaments/router.ts)
- [packages/api/src/modules/ai/router.ts](/Users/mac/Desktop/doctor.com/packages/api/src/modules/ai/router.ts)

Important pour le frontend :

- ne pas dupliquer la logique métier dans le client ;
- préférer les endpoints partagés ;
- garder le client “thin” quand c’est possible.

---

## 9. Etat actuel de l’AI Assistant web

Fichier principal :

- [apps/web/src/components/ai-assistant/AIAssistantPanel.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/ai-assistant/AIAssistantPanel.tsx)

Ce qui existe déjà :

- actions suggérées :
  - hypothèse diagnostique
  - recommandation ordonnance
  - vérification document
- chat libre unifié
- orchestrateur backend pour router les questions libres :
  - vers QnA patient
  - vers QnA médicaments
- rendu structuré des réponses AI
- modal hypothèse diagnostique
- modal ordonnance

### Règle de contexte AI

- QnA médicaments = peut marcher partout
- QnA patient = doit être sur `/patients/:id/...`
- si question patient hors page patient :
  - le backend renvoie un message métier demandant d’ouvrir la fiche patient

### Important pour l’intégration

Si le coéquipier crée de nouvelles pages frontend, il ne doit pas casser cette logique :

- si la page est dans un dossier patient,
  - l’assistant peut exploiter `currentPatientId`
- sinon,
  - seules les questions globales non patient doivent marcher

---

## 10. Etat actuel du frontend patient

Le frontend du dossier patient est déjà bien morcelé, ce qui aide à travailler à plusieurs.

### Fichiers sensibles

- `patients.$id.tsx` :
  - shell principal
  - header patient
  - tabs
  - gestion centrale des popups

### Fichiers relativement sûrs à faire évoluer indépendamment

- `patients.$id/general.tsx`
- `patients.$id/suivi.tsx`
- `patients.$id/antecedent.tsx`
- `patients.$id/traitement.tsx`
- `patients.$id/document.tsx`
- `patients.$id/vaccination.tsx`
- `patients.$id/sante-feminine.tsx`
- `patients.$id/info-sociale.tsx`
- `patients.$id/voyage.tsx`

### Popup strategy

Si une nouvelle feature a besoin d’un modal :

- créer un fichier dédié dans `popups/`
- ne pas ajouter 300 lignes dans la page parent

---

## 11. Pages déjà existantes hors dossier patient

### Patients

- [apps/web/src/routes/patients/index.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients/index.tsx)

### Agenda

- [apps/web/src/routes/agenda/index.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/agenda/index.tsx)
- [apps/web/src/routes/agenda/ajouter.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/agenda/ajouter.tsx)
- [apps/web/src/routes/agenda/modifier.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/agenda/modifier.tsx)
- `agenda/popups/*`

### Ordonnances

- [apps/web/src/routes/ordonnance/index.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/ordonnance/index.tsx)
- `ordonnance/popups/*`

### Médicaments

- [apps/web/src/routes/medicament/index.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/medicament/index.tsx)
- `medicament/popups/*`

### Aide

- [apps/web/src/routes/aide/index.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/aide/index.tsx)
- [apps/web/src/routes/aide/faq.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/aide/faq.tsx)

### Paramètres

- [apps/web/src/routes/parametres.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/parametres.tsx)
- `parametres/popups/*`

---

## 12. Design et UX déjà en place

Le produit n’est pas “design system strict”, mais il a déjà des directions fortes :

- sidebar bleue foncée
- cartes blanches avec bordures très légères bleu clair / orange
- typographie très lisible
- gros accent sur la lisibilité clinique
- IA assistant flottant global

### Ce qu’il faut préserver

- ne pas casser le layout existant du shell patient
- ne pas redesign gratuitement l’AI assistant si on n’est pas sur cette tâche
- garder les styles et contrastes cohérents avec ce qui existe
- ne pas tout migrer d’un coup vers un autre système UI

---

## 13. Données de démo utiles

Il existe plusieurs seeds de démo.

### Seeds racine

- `bun run db:seed`
- `bun run db:seed:pre-remplis`
- `bun run db:seed:demo-female`
- `bun run db:seed:demo-consultation`
- `bun run db:seed:mobile-demo`

### Patiente de démo utile

Patiente de démo riche :

- `Nadia Saidi`
- `patient_id = c0000000-0000-4000-a000-000000000001`

Une consultation récente de démo a été ajoutée pour elle :

- suivi : `c1000000-0000-4000-a000-000000000003`
- rendez-vous : `c2000000-0000-4000-a000-000000000003`
- examen : `c3000000-0000-4000-a000-000000000003`
- date : `2026-04-19`

Cas clinique :

- fièvre légère
- odynophagie
- congestion nasale
- rhinopharyngite aiguë simple sans signe de gravité

Cette consultation est utile pour :

- visualiser le dossier patient avec une consultation complète
- tester l’hypothèse diagnostique
- tester la recommandation d’ordonnance

### Autre patient de démo riche

Il existe aussi un patient homme très utilisé dans les premiers tests :

- `Walid Amara`

Doc utile :

- [RICH_PATIENT_DATA.md](/Users/mac/Desktop/doctor.com/RICH_PATIENT_DATA.md)

---

## 14. Conventions de travail recommandées pour ce coéquipier

### Si l’objectif est d’ajouter une page

Approche recommandée :

1. créer la route ou sous-route dédiée ;
2. brancher les queries tRPC depuis cette page ;
3. si besoin, créer des composants locaux ;
4. si besoin, créer des popups dédiés ;
5. toucher au shell global seulement en dernier.

### Si l’objectif est d’ajouter une action dans une page patient

Préférer :

- ajouter un popup dans `popups/`
- déclencher l’ouverture via `patient-popup-open`

### Si l’objectif est une intégration lourde

Éviter si possible de modifier simultanément :

- `sidebar.tsx`
- `AIAssistantPanel.tsx`
- `patients.$id.tsx`

Ces fichiers doivent être modifiés seulement quand l’intégration l’exige vraiment.

---

## 15. Points chauds / risques de merge conflict

### Très chauds

- [apps/web/src/components/ai-assistant/AIAssistantPanel.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/ai-assistant/AIAssistantPanel.tsx)
- [apps/web/src/routes/patients.$id.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id.tsx)
- [apps/web/src/components/sidebar.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/sidebar.tsx)

### Moyennement chauds

- [apps/web/src/routes/patients.$id/suivi.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/suivi.tsx)
- [apps/web/src/routes/patients.$id/document.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/document.tsx)
- [apps/web/src/routes/patients.$id/traitement.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id/traitement.tsx)

### Faibles si bien découpés

- nouveaux composants dans un nouveau fichier
- nouveaux popups dans `popups/`
- nouvelles pages route dédiées

---

## 16. Etat Git utile

Branche actuelle observée au moment de ce document :

- `anes/orchestrator`

Ce document est un **contexte projet**, pas une spécification de branche.  
Le coéquipier peut travailler sur sa propre branche, mais il faut garder le découpage recommandé ci-dessus.

---

## 17. Checklist rapide pour un agent frontend

Avant de coder :

- lire ce fichier
- lire `patients.$id.tsx` si la tâche touche le dossier patient
- lire `utils/trpc.ts`
- repérer si la tâche touche un fichier chaud

Pendant le travail :

- limiter les modifications aux fichiers du scope
- créer de nouveaux fichiers si possible
- ne pas refactorer toute la page sans nécessité
- ne pas casser les flows popup/event existants

Avant de finir :

- lancer le typecheck web
- vérifier que les erreurs restantes sont bien les 3 erreurs connues si elles apparaissent encore
- vérifier visuellement le rendu sur la page concernée

---

## 18. Résumé ultra court pour un autre agent

Si un agent doit résumer le projet en une minute :

- monorepo Bun/Turbo
- frontend web dans `apps/web`
- backend métier dans `packages/api`
- shell patient principal dans `apps/web/src/routes/patients.$id.tsx`
- sous-pages patient séparées
- popups séparés dans `patients.$id/popups`
- tRPC client via `apps/web/src/utils/trpc.ts`
- AI assistant global dans `apps/web/src/components/ai-assistant/AIAssistantPanel.tsx`
- fichiers les plus sensibles aux conflits :
  - `patients.$id.tsx`
  - `AIAssistantPanel.tsx`
  - `sidebar.tsx`
- stratégie anti-conflit :
  - ajouter des pages/fichiers dédiés
  - réutiliser les popups
  - éviter de toucher au shell global sans nécessité

---

## 19. Fichiers de référence utiles

- [README.md](/Users/mac/Desktop/doctor.com/README.md)
- [packagesARCH.md](/Users/mac/Desktop/doctor.com/packagesARCH.md)
- [agents/context.md](/Users/mac/Desktop/doctor.com/agents/context.md)
- [agents/TEAM_CONTEXT.md](/Users/mac/Desktop/doctor.com/agents/TEAM_CONTEXT.md)
- [apps/web/src/routes/__root.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/__root.tsx)
- [apps/web/src/routes/patients.$id.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/routes/patients.$id.tsx)
- [apps/web/src/components/sidebar.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/sidebar.tsx)
- [apps/web/src/components/ai-assistant/AIAssistantPanel.tsx](/Users/mac/Desktop/doctor.com/apps/web/src/components/ai-assistant/AIAssistantPanel.tsx)
- [apps/web/src/utils/trpc.ts](/Users/mac/Desktop/doctor.com/apps/web/src/utils/trpc.ts)
- [apps/web/src/lib/auth-client.ts](/Users/mac/Desktop/doctor.com/apps/web/src/lib/auth-client.ts)

---

## 20. Intention de ce document

Ce fichier est volontairement orienté :

- **frontend**
- **intégration**
- **travail en parallèle**
- **prévention des merge conflicts**

Il peut être donné tel quel à un coéquipier ou à son agent de code comme **contexte initial** avant de commencer une tâche.
