# doctor.com — AI Modules — Slide Content (5 slides)

---

## Slide 1 — Our approach & architecture

- An assistant, not a feature — lives inside the app, active only when asked
- One chat -> one **orchestrator** -> the right module
- Three families:
  - **Language** agents — ask in plain words
  - **Action** agents — use patient context to propose
  - **Infrastructure** agents — catch mistakes in background
- 6 modules, one door

---

## Slide 2 — Language agents

- **Patient record Q&A** — any info about a patient, instantly, without digging through the file
- **Medication assistant** — pharmacist + doctor
  - compare drugs, fast drug info
  - complex search: *"an antibiotic without penicillin"*

---

## Slide 3 — Action agents & RAG (key slide)

- **Diagnostic hypothesis** — suggests a hypothesis for the current consultation
- **Prescription recommendation** — proposes a complete prescription
- Reads the full clinical picture (last 5-8 consultations, follow-ups, treatments)
- **RAG** = retrieve real drugs first, then prescribe only from those
- Pipeline: context -> vector -> search medication DB -> model -> verify
- Two DBs: **patient = question**, **medication = knowledge**

*Visual: Patient context -> Vector search (Medication DB) -> Candidates -> Model -> Verified prescription.*

---

## Slide 4 — Infrastructure agents: the safety net

- **Medication anomaly** (manual prescription)
  - interactions, dosage, pediatric dose — rules + AI, ranked by severity
- **Document anomaly** (before saving)
  - reads PDFs / images: labs, radiology
  - flags abnormal values, points back to the source

---

## Slide 5 — Medication data: Vidal as source of truth

- Reliable drug data was a real challenge to get
- **Vidal = our source of truth** — brought inside the app
- The doctor never needs to leave for Vidal's website
- Every drug with all its information: substances, indications, interactions, safety
- Powers: **manual prescribing**, the **RAG recommendation module**, **drug search & info**
- Two separate databases: **global patient DB** + **dedicated medication DB**
