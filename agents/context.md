# Doctor.com Backend – Project Context

## 1. Project Overview

This project is a **medical clinic management system backend**.

The goal of the system is to manage:

- patients
- consultations
- prescriptions
- treatments
- appointments
- vaccinations
- medical history
- medical documents
- communication with patients
- AI medical assistance

The backend is designed using a **modular architecture** so that multiple developers can work on different modules without conflicts.

Each developer is responsible for **one module at a time**, usually on a **separate Git branch**.

---

# 2. Tech Stack

The backend uses the following technologies:

- Bun runtime
- Express.js
- TypeScript
- tRPC
- Drizzle ORM
- PostgreSQL
- Turborepo (monorepo architecture)

Architecture principles:

- clean architecture
- modular backend
- separation of concerns
- strongly typed API

---

# 3. Backend Architecture

The backend is organized into **independent modules**.

Each module contains exactly three files:

repo.ts  
service.ts  
router.ts  

### Purpose of each layer

### repo.ts

Responsible for **database access only**.

Examples of responsibilities:

- SELECT
- INSERT
- UPDATE
- DELETE

No business logic is allowed in this layer.

---

### service.ts

Responsible for **business logic**.

Examples:

- computing patient age
- computing BMI
- combining multiple queries
- applying domain rules

This layer calls the repository functions.

---

### router.ts

Responsible for **API endpoints**.

Endpoints are exposed using **tRPC**.

Responsibilities:

- input validation (Zod)
- calling services
- returning responses

The router **must never access the database directly**.

---

# 4. Project Folder Structure

Example simplified structure:

modules/

auth/  
patient/  
consultation/  
agenda/  
ordonnance/  
travel/  
treatment/  
vaccination/  
medical-history/  
documents/  
communication/  

Each module has the same internal structure:

modules/module-name/

repo.ts  
service.ts  
router.ts  

This ensures a **consistent architecture across the project**.

---

# 5. Database Overview

The system database contains several core entities.

## Patients

Tables:

patients  
patients_femmes  

Stores patient identity and medical information.

---

## Medical History

Tables:

antecedents  
antecedents_personnels  
antecedents_familiaux  

Used to store:

- personal medical history
- family medical history

---

## Consultations

Tables:

suivi  
examen_consultation  

A **suivi** represents a medical follow-up.

An **examen_consultation** stores clinical examination details.

---

## Appointments

Table:

rendez_vous  

Stores appointment scheduling information.

---

## Prescriptions

Tables:

ordonnance  
ordonnance_medicaments  

Stores prescriptions and prescribed medications.

---

## Treatments

Table:

historique_traitements  

Stores long-term treatments for a patient.

---

## Vaccinations

Table:

vaccinations_patient  

Stores vaccination history.

---

## Documents

Tables:

documents_patient  
lettres_orientation  
certificats_medicaux  

Stores medical documents.

---

# 6. Important Architectural Decision

## Medications Database Removed

Originally the database included a table:

medicaments

This table has been **removed from the system**.

Reason:

Medication data will come from an **external pharmaceutical database or API**.

Examples:

- VIDAL database
- pharmaceutical APIs
- external medication datasets

Therefore:

ordonnance_medicaments

will store medication information **without relying on a local medications table**.

This avoids duplicating pharmaceutical data inside the project.

---

# 7. Modules Implemented in the Backend

The system is divided into multiple modules.

Current modules include:

auth  
patient  
consultation  
agenda  
ordonnance  
travel  
treatment  
vaccination  
medical-history  
documents  
communication  

Each module is implemented independently.

---

# 8. Rules for Codex Code Generation

When using **Codex or AI tools to generate code**, the following rules must be respected.

## Rule 1 – Module isolation

Codex must modify **only one module at a time**.

Example:

modules/patient/

Codex must not modify any other module.

---

## Rule 2 – Database schema is fixed

The database schema is already defined.

Codex must **not modify database tables**.

---

## Rule 3 – Architecture separation

The architecture must follow:

repo → database queries  

service → business logic  

router → API endpoints  

The router must **never access the database directly**.

---

## Rule 4 – Input validation

All endpoints must use **Zod validation schemas**.

---

# 9. Example Module Architecture

Example module:

modules/patient/

repo.ts  
service.ts  
router.ts  

### repo.ts example functions

getPatientById()  
createPatient()  
updatePatient()  
searchPatients()  

Database queries only.

---

### service.ts example functions

getPatientAge()  
getPatientIMC()  
getPatientFullRecord()  

Contains business logic.

---

### router.ts endpoints

createPatient  
updatePatient  
getPatient  
searchPatients  

Exposed via **tRPC protectedProcedure**.

---

# 10. Team Development Workflow

Developers work using **Git branches**.

Example:

feature/patient  
feature/consultation  
feature/agenda  
feature/medical-history  

Rules:

- each developer works on a specific module
- do not modify other modules
- do not change database schema
- keep commits focused on one module

This reduces merge conflicts.

---

# 11. Final Goal

The goal is to build a **complete intelligent medical management backend**.

The system should support:

- patient record management
- consultations
- prescriptions
- treatments
- vaccination tracking
- appointment scheduling
- document management
- AI assistance
- communication with patients

The architecture is designed to be:

- scalable
- modular
- maintainable
- suitable for collaborative development.   