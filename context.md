# Project Context: doctor.com

This document provides a comprehensive overview of the `doctor.com` project, its architecture, implemented modules (backend, AI, frontend), and tools. It is intended to provide Claude with the necessary context to build a new AI module for generating medical documents (orientation letters, explorations, and medical certificates).

---

## 1. Project Overview
`doctor.com` is a modern medical management platform (SaaS) designed for doctors. It handles patient records, consultations, prescriptions, and advanced AI-assisted medical tasks.

## 2. Repository Architecture
The project is a monorepo built with **Bun** and managed by **Turborepo**.

### Core Structure:
- **`apps/`**:
  - `server`: The main backend application (Express + tRPC).
  - `web`: The frontend application (React + TanStack Router).
  - `native`: (In development) Mobile application (Expo/React Native).
- **`packages/`**:
  - `api`: The core tRPC logic (routers, services, repositories).
  - `db`: Database schema (Drizzle ORM), migrations, and client.
  - `auth`: Authentication logic (Better-Auth).
  - `shared`: Shared Zod schemas, types, and error codes.
  - `env`: Centralized environment variable validation.
  - `config`: Shared TypeScript/linting configurations.

## 3. Technology Stack

### Backend
- **Runtime**: Bun
- **Framework**: Express (hosting tRPC)
- **API Layer**: tRPC (Type-safe communication)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Better-Auth
- **Validation**: Zod
- **Infrastructure**: MinIO (S3-compatible storage for documents)

### Frontend
- **Framework**: React 19
- **Styling**: Tailwind CSS v4 + Shadcn UI
- **Routing**: TanStack Router
- **Data Fetching**: TanStack Query (via tRPC client)
- **Icons**: Lucide React

### AI Layer
- **Providers**: Google Gemini (via `@ai-sdk/google`)
- **SDK**: Vercel AI SDK (`ai` package)
- **Deployment**: Integrated into the tRPC backend modules.

---

## 4. AI Module Implementation Details

The AI functionality is centralized in `packages/api/src/modules/ai`.

### Current Sub-modules:
- **`qna`**: General medical assistant that answers questions based on full patient records.
- **`anomaly-flag`**: Detects anomalies in patient data or documents.
- **`hypothese-diagnostic`**: Suggests potential diagnoses based on symptoms and history.
- **`ordonnance-recommendation`**: Recommends treatments or highlights drug interactions.
- **`medication-assistant`**: Provides detailed information and safety checks for medications.
- **`assistant`**: General clinical assistant.

### AI Module Design Pattern:
Each AI sub-module follows a consistent structure:
1.  **`router.ts`**: Defines the tRPC procedures.
2.  **`service.ts`**: Orchestrates logic, builds prompts, and calls the AI provider.
3.  **`repo.ts`**: Handles database queries to gather necessary context.
4.  **`shared/`**: Common AI utilities (provider config, error mapping).

### Context Building (Crucial for Claude):
The `qna` module's `AiRepository` has a `getFullPatientData` method that aggregates:
- Base patient info (Nom, Prénom, Age, Sexe, etc.)
- Specific data (Gyneco for women, recent travels)
- Medical history (Antecedents personnels/familiaux)
- Follow-up history (`suivi`)
- Consultations and examinations (`examen_consultation`)
- Treatments and prescriptions (`ordonnance`, `ordonnance_medicaments`)
- Vaccinations, existing certificates, and orientation letters.

**Example Prompt Building logic (`AiService`):**
It uses a structured prompt combining `system` instructions ("Vous êtes un assistant médical...") with the `patientContext` (formatted markdown) and the doctor's specific query.

---

## 5. Document Management & Data Schemas

For the document generation module, the following database tables (defined in `packages/db/src/schema/documents.ts`) are relevant:

### `lettres_orientation`
- `suivi_id`: Link to the consultation/follow-up.
- `type_exploration`: Type of exploration (e.g., Radiology, Lab).
- `examen_demande`: The specific exam requested.
- `raison`: Clinical justification.
- `destinataire`: Specialist or facility.
- `urgence`: Enum (Normal, Urgent, Très Urgent).
- `contenu_lettre`: The generated text.

### `certificats_medicaux`
- `type_certificat`: Enum (Aptitude, Arrêt de travail, Certificat de constatation, etc.).
- `date_debut` / `date_fin`: For sick leave.
- `diagnostic`: Relevant diagnosis.
- `destinataire`: To whom it may concern.
- `notes`: Additional clinical notes.
- `statut`: Enum (Brouillon, Signé).

### `documents_patient`
The master table for all files, tracking `chemin_fichier` (S3 path), `taille_fichier`, and categories.

---

## 6. Goal: Building the Document Generation AI Module

The objective is to create a new module `packages/api/src/modules/ai/document-generator` (or similar) that:
1.  **Extracts context**: Uses `getFullPatientData` and the current `suivi_id` context.
2.  **Generates content**:
    *   **Orientation Letters**: Drafts a professional letter explaining why the patient is being referred and what tests are needed.
    *   **Certificates**: Fills in the medical reasoning for a specific certificate type based on the latest consultation.
3.  **Adheres to medical standards**: Professional tone, clear structure, and adherence to specific French medical document conventions.

### Required AI Logic:
- **Input**: `patient_id`, `suivi_id`, `document_type`, and optional `user_instructions`.
- **System Prompt**: Must guide the model to be precise, professional, and strictly based on the patient's data.
- **Output**: Structured JSON or Markdown content that can be saved to the database and eventually converted to PDF.

---

## 7. Development Workflow Summary
1.  Define Zod DTOs in `packages/shared`.
2.  Implement `repo.ts` to fetch specific data needed for documents.
3.  Implement `service.ts` to build the prompt and call Gemini.
4.  Expose via `router.ts` in the tRPC `aiRouter`.
5.  Frontend calls the procedure and displays the draft for validation/editing.
