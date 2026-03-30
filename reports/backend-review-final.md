# Backend Review Final

Date: 2026-03-30  
Repo: `doctor.com`  
Portee de cette passe: stabilisation backend finale, nettoyage AI Gemini-only, messages d'erreur simples, tests cibles AI, statut global des routes.

## 1. Resume executif

Cette passe a permis de finaliser les points suivants:

- migration des modules AI vers **Gemini uniquement**
- suppression du code multi-provider (`OpenRouter`, `Mistral`, `Together`) dans `packages/` et `apps/`
- ajout d'une couche AI partagee pour:
  - appel Gemini via AI-SDK
  - parsing JSON tolerant
  - normalisation de texte
  - mapping d'erreurs simple en francais
- ajout de `response_mode: "ordonnance" | "medicaments"` sur `ai.ordonnanceRecommendation.generate`
- ajout d'un `errorFormatter` tRPC pour des messages d'entree plus lisibles
- ajout d'une suite de tests Bun ciblee pour les 3 modules AI principaux

Checks executes dans cette passe:

- `bunx tsc --noEmit -p packages/api/tsconfig.json`
- `bun run check-types:backend`
- `bun test packages/api/tests/**/*.test.ts`

## 2. Decisions d'architecture

### 2.1 AI Gemini-only

Decision retenue:

- Gemini devient l'unique provider AI officiel du repo
- tous les branchements conditionnels multi-provider ont ete retires
- la couche provider AI a ete simplifiee autour de `@ai-sdk/google`

Benefices:

- moins de code conditionnel
- moins d'erreurs provider-specifiques
- comportement plus stable pour le frontend

### 2.2 `ordonnanceRecommendation` avec deux vues metier

Une seule route est conservee:

- `ai.ordonnanceRecommendation.generate`

Elle accepte maintenant:

- `response_mode: "ordonnance" | "medicaments"`

Effet:

- `ordonnance`: reponse ordonnance complete
- `medicaments`: suggestions unitaires de medicaments pour UI drag-and-drop

### 2.3 Validation et erreurs

Objectif retenu:

- messages exposes au frontend en francais simple
- details techniques conserves cote logs / cause interne

## 3. Statut des modules backend

Legende:

- `OK`: structure et comportement global juges satisfaisants dans le scope de cette passe
- `OK avec reserves`: structure correcte, mais pas de couverture d'integration complete dans cette passe
- `Corrige dans cette passe`: point reellement modifie et stabilise
- `A revoir plus tard`: techniquement exploitable, mais merite encore une refactorisation plus profonde

| Module | Statut | Resume |
|---|---|---|
| `auth` | OK avec reserves | Routeur coherent, procedures publiques/protegees conformes, pas de regression visible dans cette passe. |
| `patient` | OK avec reserves | Structure router/service/repo conforme, pas de anomalie structurelle evidente relevee. |
| `consultation` | OK avec reserves | Validation Zod correcte cote router, perimetre critique pour AI bien relie aux suivis/examens. |
| `ordonnance` | OK avec reserves | Module metier non AI coherent dans la structure, non refactore dans cette passe. |
| `agenda` | OK avec reserves | Pas d'anomalie structurelle evidente lors du survol des routes exposees. |
| `medical-history` | OK avec reserves | Structure conforme, reserve principale: couverture de tests insuffisante hors scripts metier. |
| `medicaments` | OK avec reserves | Module important pour les AI, structure claire, tres utile comme base de verite locale. |
| `vaccination` | OK avec reserves | Pas d'anomalie structurelle evidente relevee. |
| `travel` | OK avec reserves | Pas d'anomalie structurelle evidente relevee. |
| `documents` | OK avec reserves | Module stable structurellement, reserve sur couverture de tests. |
| `treatment` | OK avec reserves | Module coherent, utilise indirectement par les AI. |
| `export` | OK avec reserves | Non modifie dans cette passe, pas de signal de casse structurelle. |
| `apps/server` runtime | Corrige dans cette passe | Typecheck backend stabilise; exclusion des scripts de smoke tests du build TypeScript runtime serveur. |

## 3.1 Routes exposees au niveau `appRouter`

Routes tRPC principales exposees:

- `agenda`
- `ai`
- `auth`
- `consultation`
- `documents`
- `export`
- `medicalHistory`
- `medicaments`
- `ordonnance`
- `patient`
- `travel`
- `treatment`
- `vaccination`

Sous-routes AI confirmees:

- `ai.anomalyFlag`
- `ai.documentAnomaly`
- `ai.hypotheseDiagnostic`
- `ai.medicationAssistant`
- `ai.ordonnanceRecommendation`
- `ai.qna`

## 3.2 Resultat de la review structurelle des routeurs

Constats verifies dans cette passe:

- les `router.ts` backend critiques inspectes continuent de respecter la convention `router -> service -> repo`
- aucun acces base de donnees direct n'a ete releve dans les routeurs inspectes
- les references `ctx.db` et `ctx.session` sont bien transmises aux services, pas exploitees pour requeter directement la base dans les routeurs
- `agenda/router.ts` et `medical-history/router.ts` importent des constantes de schema, mais pas de logique de requete directe
- `export/router.ts` appelle directement `exportService` avec `ctx.db`, ce qui reste coherent avec l'architecture du projet

Point corrige pendant cette review:

- ajout de `@noble/hashes` dans `packages/api/package.json` pour corriger le chargement runtime de `pdfkit` utilise par `documents` et `ordonnance`

## 4. Statut detaille des modules AI

| Module AI | Statut | Etat |
|---|---|---|
| `hypotheseDiagnostic` | Corrige dans cette passe | Gemini-only, normalisation/troncature avant validation, reponse exploitable stabilisee. |
| `ordonnanceRecommendation` | Corrige dans cette passe | Gemini-only, double mode `ordonnance/medicaments`, fallback local, pipeline amont mutualise. |
| `medicationAssistant` | Corrige dans cette passe | Gemini-only, meilleure logique backend-first, fallback deterministe plus utile pour la recherche catalogue. |
| `qna` | Corrige dans cette passe | Nettoye en Gemini-only. |
| `anomaly-flag` | Corrige dans cette passe | Nettoye en Gemini-only. |
| `document-anomaly` | Corrige dans cette passe | Nettoye en Gemini-only. |

## 5. Tests ajoutes

Fichier:

- `packages/api/tests/ai-services.test.ts`
- `packages/api/tests/router-registry.test.ts`
- `packages/api/tests/critical-routes.test.ts`

Couverture ajoutee:

### `hypotheseDiagnostic`

- normalisation des champs AI trop longs
- verification que les longueurs sont tronquees avant la validation finale

### `ordonnanceRecommendation`

- verification du shaping `response_mode = "medicaments"`
- verification de la deduplication des suggestions
- verification du fallback deterministe sur un candidat antalgique/antipyretique simple

### `medicationAssistant`

- detection `requires_patient_context`
- detection d'intentions `compare` et `safety`
- generation d'une reponse fallback utile pour une demande `antipyretique`

### Routes metier critiques

- `patient.getPatient`
  - auth requise
  - happy path route -> service
- `consultation.createSuivi`
  - validation input (date)
- `consultation.getPatientSuivis`
  - happy path route -> service
- `medicaments.rechercherMedicaments`
  - happy path route -> service
- `documents.getDocument`
  - validation uuid
  - happy path route -> service
- `ordonnance.getOrdonnanceById`
  - happy path route -> service
- `ordonnance.creerOrdonnance`
  - validation medicaments requis

## 6. Points corriges dans cette passe

### 6.1 Messages d'erreur tRPC

Ajout d'un `errorFormatter` global dans `packages/api/src/trpc/init.ts` pour:

- simplifier les erreurs de validation Zod
- conserver un message plus lisible pour le frontend

### 6.2 Environnement AI

Nettoyage de:

- `packages/env/src/server.ts`
- `apps/server/.env.example`

Decision:

- seule la configuration Gemini reste visible dans le repo

### 6.3 Couche AI partagee

Ajouts:

- `packages/api/src/modules/ai/shared/provider.ts`
- `packages/api/src/modules/ai/shared/errors.ts`
- `packages/api/src/modules/ai/shared/json.ts`
- `packages/api/src/modules/ai/shared/format.ts`

But:

- reduire la duplication la plus critique
- centraliser les comportements AI transverses

## 7. Reserves restantes

### P1

- Les gros services AI (`ordonnance-recommendation`, `medication-assistant`) restent encore longs.
- Ils sont plus propres qu'avant grace a la couche shared et a l'extraction des schemas, mais une decomposition plus fine reste possible (`intent.ts`, `ranking.ts`, `response-builders.ts`, etc.).

### P1

- Les tests automatises couvrent maintenant les modules AI et plusieurs routes metier critiques, mais pas encore l'ensemble des routes non-AI du repo.
- Pour une CI backend complete, il faudra encore ajouter progressivement des tests sur `agenda`, `travel`, `treatment`, `vaccination`, `auth`, `export`, `medical-history`.

### P2

- `apps/server/tsconfig.json` exclut les scripts de smoke tests pour que le typecheck backend runtime reste stable.
- C'est acceptable pour la livraison backend runtime, mais ces scripts pourraient etre deplaces vers un dossier/tests mieux isole plus tard.

## 8. Decision finale de livraison

Etat recommande pour passage au frontend:

- `hypotheseDiagnostic`: **livrable**
- `ordonnanceRecommendation`: **livrable**
- `medicationAssistant`: **livrable avec reserves de raffinement futur**
- backend global: **livrable pour integration frontend**

Recommandation pratique:

- brancher le frontend sur Gemini uniquement
- utiliser `response_mode = "ordonnance"` pour le bouton d'ordonnance AI
- utiliser `response_mode = "medicaments"` pour la zone de suggestions drag-and-drop

## 9. Prochaine etape recommandee apres integration frontend

1. Ajouter des tests d'integration metier sur les routes non-AI les plus utilisees.
2. Continuer la decomposition interne de `ordonnance-recommendation/service.ts`.
3. Continuer la decomposition interne de `medication-assistant/service.ts`.
4. Ajouter des smoke tests Gemini optionnels si une cle env est presente en local/CI.
