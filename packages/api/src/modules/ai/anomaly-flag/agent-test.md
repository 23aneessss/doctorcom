# AI Anomaly Flag Test Document

Procedure testee: `anomalyFlag.checkPrescription`

Module: `packages/api/src/modules/ai/anomaly-flag`

---

## Scope

Ce document decrit une strategie de test pour la detection d'anomalies de prescription:

- regles automatiques par medicament
- regles globales d'interactions
- comportement de fallback quand l'IA n'est pas disponible

Le script associe est:

- `apps/server/src/scripts/anomaly-flag/test-anomaly-detection.ts`

---

## Test Environment

### Prerequis

| Etape | Commande | But |
|---|---|---|
| 1 | `bun run db:reset` | Nettoyer la base metier |
| 2 | `bun run db:seed` | Injecter utilisateurs/patients de base |
| 3 | `bun run medications-db:seed` | Injecter la base medicaments externe |

### Execution du test

| Mode | Commande |
|---|---|
| Standard | `bun apps/server/src/scripts/anomaly-flag/test-anomaly-detection.ts --prepare` |
| Avec reseed complet | `bun apps/server/src/scripts/anomaly-flag/test-anomaly-detection.ts --reseed --prepare` |
| Sortie JSON | `bun apps/server/src/scripts/anomaly-flag/test-anomaly-detection.ts --prepare --json` |

Le script appelle l'API via HTTP:

- Login Better Auth: `POST /api/auth/sign-in/email`
- Verification anomaly: `POST /trpc/ai.anomalyFlag.checkPrescription`

Variables optionnelles:

- `ANOMALY_TEST_SERVER_URL` (defaut: `http://localhost:${PORT || 3000}`)
- `ANOMALY_TEST_EMAIL` (defaut: `tbib@doctorcom.com`)
- `ANOMALY_TEST_PASSWORD` (defaut: `doctor123!`)

### Appel manuel HTTP (plain POST non-batche)

1. Login et recuperation du cookie de session:

```bash
curl -i -X POST "http://localhost:3000/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "email": "tbib@doctorcom.com",
    "password": "doctor123!"
  }'
```

2. Appel mutation tRPC avec cookie (format recommande non-batche):

```bash
curl -X POST "http://localhost:3000/trpc/ai.anomalyFlag.checkPrescription" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<SESSION_TOKEN>" \
  --data-raw '{
    "patient_id": "9f58c0fe-9bd9-4a66-86ba-becb6fa55c39",
    "medicaments": [
      {
        "medicament_externe_id": "6",
        "posologie": "daily",
        "dosage": "standard",
        "duree_traitement": "7 jours"
      }
    ]
  }'
```

Note:
- `checkPrescription` est une **mutation** (`protectedProcedure.mutation`), donc appel en POST.
- Les champs doivent respecter exactement le schema router.

### Erreurs courantes

- Mauvaise cle: `medicament_external_id` -> utiliser `medicament_externe_id`.
- Melange de formats batch/non-batch:
  - non-batch: body = input brut (comme ci-dessus), sans `?batch=1`
  - batch: `?batch=1` + body indexe (`{"0": input}`)
- Cookie de session manquant ou invalide.
- `patient_id` non UUID.
- `medicaments` vide, ou `posologie` vide.

---

## Deterministic Fixture Patients

Le script cree/met a jour ces profils:

| Profil | Matricule | Objectif principal |
|---|---|---|
| Female risk | `TEST-ANOM-F-001` | Tester grossesse/allaitement |
| Child | `TEST-ANOM-C-001` | Tester absence posologie pediatrique |
| Chronic | `TEST-ANOM-H-001` | Tester CI/precaution + interactions |
| Semantic negative | `TEST-ANOM-N-001` | Verifier CI/precaution non applicables |

---

## Medication Selection Strategy

Les IDs de medicaments sont **resolus dynamiquement** depuis `@doctor.com/medications-db`.

- Les tests utilisent toujours des IDs numeriques convertis en string (`"123"`)
- Le script evite les IDs de type `EXT-*`
- Si un candidat n'est pas trouvable dans le dataset courant, le scenario passe en `SKIP` avec raison explicite

---

## Test Cases Matrix

| # | Scenario | Expected codes | Severity |
|---|---|---|---|
| S1 | Pregnancy contraindication | `PREGNANCY_CONTRAINDICATION` | error |
| S2 | Breastfeeding risk | `BREASTFEEDING_RISK` | warning |
| S3 | Child no pediatric dosage | `CHILD_NO_PEDIATRIC_DOSAGE` | warning |
| S4 | Contre-indication match | `CONTRE_INDICATION_MATCH` | error |
| S5 | Precaution match | `PRECAUTION_MATCH` | warning |
| S6 | Drug interaction (same prescription) | `DRUG_INTERACTION` | error |
| S7 | Existing treatment interaction | `EXISTING_TREATMENT_INTERACTION` | error |
| S8 | Medication not found | `MEDICATION_NOT_FOUND` | info |
| S9 | AI availability fallback | `ai_available=false` si pas de cle | info |
| S10 | CI non applicable au patient | absence de `CONTRE_INDICATION_MATCH` et `PRECAUTION_MATCH` | negative |
| S11 | Precaution non applicable au patient | absence de `CONTRE_INDICATION_MATCH` et `PRECAUTION_MATCH` | negative |

### Negative Validation Cases (Blocking)

| # | Scenario | Expected error | Contract tested |
|---|---|---|---|
| N1 | Invalid patient UUID | `BAD_REQUEST` | `patient_id` must be UUID |
| N2 | Empty medicaments array | `BAD_REQUEST` + `Au moins un medicament est requis.` | `medicaments` min(1) |
| N3 | More than 20 medicaments | `BAD_REQUEST` + `Maximum 20 medicaments par verification.` | `medicaments` max(20) |
| N4 | Blank `medicament_externe_id` | `BAD_REQUEST` | trimmed non-empty field |
| N5 | Blank `posologie` | `BAD_REQUEST` | trimmed non-empty field |
| N6 | Unauthenticated request | `UNAUTHORIZED` | `protectedProcedure` auth guard |

Notes:
- Ces tests valident le contrat router (validation/auth) avant la logique metier du service.
- Le cas `medicament_externe_id` avec zeros en tete (ex: `"0006"`) est conserve comme comportement connu a clarifier, pas bloquant pour cette suite.

---

## Test Results

Execution date: 2026-03-18

Commande:

- `bun run ai:anomaly:test --json`

| # | Scenario | Observed | Remark |
|---|---|---|---|
| S1 | Pregnancy contraindication | `AI_UNAVAILABLE`, `PREGNANCY_CONTRAINDICATION` | PASS |
| S2 | Breastfeeding risk | `BREASTFEEDING_RISK`, `PREGNANCY_CONTRAINDICATION` | PASS |
| S3 | Child no pediatric dosage | `AI_UNAVAILABLE`, `CHILD_NO_PEDIATRIC_DOSAGE` | PASS |
| S4 | Contre-indication match | `AI_UNAVAILABLE`, `CONTRE_INDICATION_MATCH`, `EXISTING_TREATMENT_INTERACTION`, `PRECAUTION_MATCH` | PASS |
| S5 | Precaution match | `AI_UNAVAILABLE`, `CONTRE_INDICATION_MATCH`, `EXISTING_TREATMENT_INTERACTION`, `PRECAUTION_MATCH` | PASS |
| S6 | Drug interaction (same prescription) | `AI_UNAVAILABLE`, `CONTRE_INDICATION_MATCH`, `DRUG_INTERACTION`, `EXISTING_TREATMENT_INTERACTION`, `PRECAUTION_MATCH` | PASS |
| S7 | Existing treatment interaction | `AI_UNAVAILABLE`, `CONTRE_INDICATION_MATCH`, `EXISTING_TREATMENT_INTERACTION`, `PRECAUTION_MATCH` | PASS |
| S8 | Medication not found | `AI_UNAVAILABLE`, `MEDICATION_NOT_FOUND` | PASS |
| S9 | AI availability fallback | `AI_UNAVAILABLE`, `MEDICATION_NOT_FOUND` | PASS (`ai_available=false`) |
| S10 | CI non applicable au patient | (aucun code interdit) | PASS |
| S11 | Precaution non applicable au patient | (aucun code interdit) | PASS |
| N1 | Invalid patient UUID | `BAD_REQUEST` | PASS |
| N2 | Empty medicaments array | `BAD_REQUEST` | PASS |
| N3 | More than 20 medicaments | `BAD_REQUEST` | PASS |
| N4 | Blank medicament_externe_id | `BAD_REQUEST` | PASS |
| N5 | Blank posologie | `BAD_REQUEST` | PASS |
| N6 | Unauthenticated request | `UNAUTHORIZED` | PASS |

---

## Summary

| Category | Pass | Fail | Skip | Total |
|---|---|---|---|---|
| Positive anomaly checks | 9 | 0 | 0 | 9 |
| Negative validation checks | 6 | 0 | 0 | 6 |
| Semantic negative checks | 2 | 0 | 0 | 2 |
| **Total** | **17** | **0** | **0** | **17** |
