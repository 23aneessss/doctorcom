# 🎯 Plan de finalisation des modules AI

Basé sur l'audit complet de la codebase.

**Priorisation :**

- **P0** : bloquant pour la production
- **P1** : important
- **P2** : optimisation future

---

## 📋 P0 — À faire avant production

**Durée estimée : 1 à 2 jours**

### 1. Tests end-to-end avec patients réels variés

Les modules sont structurés correctement, mais ils n'ont pas encore été testés avec assez de variabilité.

Créer les 4 profils de test suivants :

| Profil | Caractéristiques | Modules à tester |
|---|---|---|
| Patient minimal | Juste nom, prénom, date de naissance | `qna`, `assistant`, `ordonnance-recommendation` |
| Patient riche | Tous les champs + 5+ antécédents + 3+ traitements actifs | `hypothese-diagnostic`, `anomaly-flag` |
| Femme enceinte | `sexe = féminin`, `donnees_femme` avec grossesse | `anomaly-flag` règle 1 + 2, `document-recommendation` |
| Enfant < 12 ans | `date_naissance` récente | `anomaly-flag` règle 3, `ordonnance` |

Pour chaque profil, exécuter chaque module et vérifier :

- Pas de crash.
- Pas de placeholder `[Votre Nom]` ou `[Date]` dans les documents.
- Les warnings sont pertinents.
- Le statut `ready` ou `blocked` est cohérent.

---

### 2. Logging production

Activer et centraliser les logs `logAiError` qui existent déjà dans `shared/errors.ts`.

Stocker les logs en base de données ou les envoyer vers un service comme Sentry ou Logtail.

Informations à logger :

- Module ayant échoué.
- `patient_id` concerné.
- Provider utilisé : Gemini ou Ollama.
- Message d'erreur.

C'est essentiel pour comprendre quels cas cliniques posent problème en production.

---

### 3. Variables d'environnement

Vérifier le fichier `.env.production` :

- `GEMINI_API_KEY` valide avec quota suffisant.
- Facturation activée pour éviter les rate limits.
- `GEMINI_MODEL = gemini-2.5-flash` pour un modèle rapide avec de bonnes performances médicales.
- Ou `GEMINI_MODEL = gemini-2.5-pro` pour une qualité supérieure, mais avec un coût plus élevé.
- `OLLAMA_BASE_URL` configuré comme fallback si possible, notamment pour la souveraineté des données médicales.

---

## 🔧 P1 — Améliorations importantes

**Durée estimée : 2 à 3 jours**

### 4. Élargir les profils de policy dans `medication-assistant`

Actuellement, seuls 7 profils sont présents :

- `antipyretic`
- `analgesic`
- `cough_wet`
- `cough_dry`
- `nasal_congestion`
- `bronchodilator_inhaled`
- `antibiotic_general`

Ajouter les profils suivants :

| Profil à ajouter | Pattern regex | Termes seed |
|---|---|---|
| `cardiovascular` | `/hypertension\|tension\|cardiaque\|coronaire/` | `"antihypertenseur"`, `"betabloquant"`, `"iec"`, `"sartan"`, `"amlodipine"` |
| `diabetes` | `/diabet\|glycemie\|insulinoresist/` | `"antidiabetique"`, `"metformine"`, `"insuline"`, `"sulfonylur"` |
| `gastric` | `/gastrite\|reflux\|ulcere\|brulure estomac/` | `"ipp"`, `"omeprazole"`, `"antiacide"`, `"pantoprazole"` |
| `anxiolytic` | `/anxiet\|stress\|insomnie\|sommeil/` | `"anxiolytique"`, `"benzodiazepine"`, `"alprazolam"` |
| `dermato` | `/eczema\|acne\|psoriasis\|prurit/` | `"dermocorticoide"`, `"antifongique cutane"` |

**Fichier à modifier :**

```txt
packages/api/src/modules/ai/medication-assistant/service.ts
```

**Zone concernée :** lignes environ `600-800`.

**Méthodes concernées :**

- `derivePolicyProfile`
- `buildIdentitySearchTerms`
- `getPolicyExpansionTerms`

---

### 5. Améliorer le fallback de recherche dans `ordonnance-recommendation`

Le tokenizer actuel exige des mots de 4 caractères ou plus.

Problème : certains acronymes médicaux courants sont rejetés, par exemple :

- `RGO`
- `HTA`

Alors que `fievre` passe correctement.

Action recommandée : ajouter un dictionnaire d'acronymes médicaux dans `tokenizeSearchText`.

| Acronyme | Expansion |
|---|---|
| `HTA` | `hypertension` |
| `RGO` | `reflux` |
| `DT2` | `diabete` |
| `BPCO` | `bronchopneumopathie` |
| `IRC` | `insuffisance renale` |

**Fichier à modifier :**

```txt
packages/api/src/modules/ai/ordonnance-recommendation/service.ts
```

**Zone concernée :** ligne environ `1265`.

---

### 6. Vérification croisée Gemini sur les anomalies critiques

Dans `anomaly-flag/service.ts`, le passage IA tourne après les règles déterministes.

Mais si une règle déterministe détecte une anomalie avec :

```ts
severity: "error"
```

Par exemple :

- interaction médicamenteuse ;
- contre-indication ;
- anomalie critique.

L'IA devrait confirmer ou expliquer ce diagnostic au lieu de chercher directement de nouvelles anomalies.

Action recommandée : ajouter un mode `verify_only`.

Ce mode doit passer les anomalies déjà détectées au prompt IA avec une consigne du type :

> Confirme-tu ces anomalies ? Y a-t-il des nuances cliniques ?

---

### 7. Améliorer les schémas de sortie

Plusieurs services utilisent Zod avec :

```ts
.default("")
```

Cela peut produire des chaînes vides au lieu de `null`.

Standardiser les champs optionnels avec :

```ts
z.string().nullable().optional()
```

Au lieu de :

```ts
z.string().default("")
```

Services concernés :

- `document-recommendation`
- `ordonnance-recommendation`
- `hypothese-diagnostic`

Objectif : obtenir une sortie plus propre, plus cohérente et plus facile à valider côté frontend/API.

---

## 🚀 P2 — Optimisations futures

**Période : post-launch**

### 8. Cache des embeddings

`generateGeminiEmbedding` est appelé à chaque génération d'ordonnance.

Recommandation : cacher les embeddings par hash de :

```ts
clinicalProblemBasis.chief_problem
```

Durée proposée : **24h**.

Options de stockage :

- Redis
- Table PostgreSQL

Gain estimé : environ **80% d'économie** sur les appels Gemini embedding.
  
---

### 9. Streaming pour l'UX

Les générations de documents prennent environ **5 à 15 secondes**.

Recommandation : utiliser `streamText` au lieu de `generateText` dans `document-recommendation`.

Objectif : afficher la lettre ou le certificat au fur et à mesure de la génération.

Résultat : meilleure UX perçue.

---

### 10. A/B testing sur les températures

Les températures actuelles sont principalement entre `0.1` et `0.2`.

Tester :

| Température | Usage recommandé |
|---|---|
| `0.0` | Extraction stricte, par exemple `document-anomaly` |
| `0.2` | Rédaction, par exemple certificat |
| `0.4` | Brainstorming d'hypothèses, par exemple `hypothese-diagnostic` |

---

### 11. Métriques d'usage

Ajouter un dashboard interne montrant :

- Temps moyen par module.
- Taux d'erreur par module.
- Top 10 des `chief_problem` les plus fréquents.
- Taux de `blocked` vs `ready` pour les ordonnances.

Objectif : savoir précisément où concentrer les améliorations futures.

---

### 12. Re-ranking avec un second LLM

Pour les recommandations de médicaments critiques, utiliser un modèle vérificateur.

Ce pattern existe déjà partiellement dans :

```txt
ordonnance-recommendation via runGeminiVerification
```

Étendre ce pattern à :

- `anomaly-flag`
- `hypothese-diagnostic`

---

## ✅ Checklist finale avant lancement

- [ ] Les 4 profils de patients de test passent sans erreur.
- [ ] Logs production configurés : Sentry, Logtail ou base de données.
- [ ] `GEMINI_API_KEY` avec billing activé en production.
- [ ] Disclaimers visibles dans l'UI pour chaque sortie AI :
  - [ ] `Brouillon généré par IA. Le médecin doit relire et valider.`
  - [ ] `Aide au raisonnement clinique uniquement.`
- [ ] Bouton `Signaler une réponse incorrecte` dans l'UI.
- [ ] Les feedbacks alimentent une table `feedback`.
- [ ] Conditions générales d'utilisation avec clause de responsabilité médicale.
- [ ] Backup quotidien de la base `medicaments`, qui est le catalogue source de vérité.
- [ ] Rate limiting par utilisateur, par exemple `50 générations IA/jour`.
- [ ] Monitoring du quota Gemini avec alerte à 80% du quota mensuel.

---

## 🎓 Conseil final

Vous êtes à environ **90% du chemin**.

Les modules sont bien architecturés, le code est propre et les fallbacks sont en place.

Ce qui manque n'est pas principalement du code, mais plutôt :

1. Des données réelles pour valider en conditions cliniques.
2. Du feedback de médecins réels en bêta privée, idéalement 5 à 10 médecins pendant 2 semaines.
3. Du monitoring pour itérer sur ce qui fonctionne mal.

Ne tombez pas dans le piège du sur-engineering.

Lancez en bêta, collectez du feedback, puis itérez.

Les médicaments orange ou cardiologie qui manquent dans le seed peuvent être ajoutés progressivement, surtout lorsqu'un médecin signale que le système fonctionne mal sur certains profils comme les patients diabétiques.

**Bonne chance avec doctor.com 🩺**
