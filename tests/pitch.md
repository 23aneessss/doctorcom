## Slide 1 — Our approach & architecture

We didn't build a separate AI page or put buttons everywhere. The doctor's real work is consultations and prescriptions, so we made one assistant that lives inside the app and shows up only when needed. One chat, one orchestrator that reads the intent and routes it. Three families behind it: language agents, action agents, and infrastructure agents. Six modules, one door.

---

## Slide 2 — Language agents

Two agents that you just talk to. The first answers questions about a patient's record — instead of scrolling through the file, the doctor just asks and gets the answer. The second is a medication assistant, a mix between a pharmacist and a doctor: compare two drugs, get info on a medication in seconds, or handle a complex search like *"an antibiotic without penicillin"*.

---

## Slide 3 — Action agents & RAG (key slide)

- This is the heart of the project. Two action agents: a diagnostic hypothesis for the current consultation, and the one that matters most — prescription recommendation.
- The key is *how* it works. A naive AI generates drug names from memory, which is dangerous — it can invent things. We use **RAG**: before writing anything, it first **retrieves real medications from our own database**, then builds the prescription using only those.
- The pipeline: we gather the patient's clinical context — the reason for the visit, the exam, last consultations, follow-ups, active treatments. We turn it into a vector and search the medication database, where every drug is pre-indexed by its indications, substances, and safety profile. The model writes a structured prescription from those real candidates, and a verification step re-checks the draft.
That's also why we have two databases: the patient DB is the *question*, the medication DB is the *knowledge*, and the recommendation bridges them.

---

## Slide 4 — Infrastructure agents: the safety net

Two agents working in the background. The first watches over manual prescriptions — it checks for dangerous interactions, dosage or posology problems, and missing pediatric doses. It's a hybrid: fixed medical rules for the clear cases, plus an AI pass for the subtler ones, with every alert ranked by severity. The second reads documents before they're saved — lab results, radiology reports — flags abnormal values, and points back to exactly where it saw each one in the document. Together they cut errors at the two riskiest moments: writing a prescription and filing a document.

---

## Slide 5 — Medication data: Vidal as source of truth

Getting reliable drug data was a real challenge. Our source of truth is **Vidal**, the medical drug reference, and we brought it entirely inside the app. So the doctor never needs to open Vidal's website again — every medication is right there, with all its information: active substances, indications, interactions, safety notes. That database powers three things: writing prescriptions manually, the RAG recommendation module, and the medication assistant. And it's kept as a separate database from the patient data — the patient DB is live clinical data, the medication DB is a reference catalog. That separation is what makes the vector search and the RAG pipeline possible.
