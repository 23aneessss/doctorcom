You are an expert backend developer working on a medical SaaS platform called doctor.com. Your task is to implement a new AI sub-module called `document-generator` inside `packages/api/src/modules/ai/`.



\## Codebase Architecture

The project is a Bun monorepo with Turborepo. The AI layer lives in `packages/api/src/modules/ai/`. Each sub-module has:

\- `router.ts` — tRPC procedures

\- `service.ts` — prompt building + Gemini API call via Vercel AI SDK (`ai` package + `@ai-sdk/google`)

\- `repo.ts` — Drizzle ORM queries



Look at the existing modules (`qna`, `ordonnance-recommendation`) to understand the exact patterns used: how the `AiRepository` is instantiated, how `getFullPatientData` is called, how the system prompt is structured, and how the Vercel AI SDK `generateText` or `streamText` is invoked.



\## Your Task

Create `packages/api/src/modules/ai/document-generator/` with the following files:



\### 1. `packages/shared/src/dtos/document-generator.dto.ts`

Define Zod schemas for:

\- `GenerateOrientationLetterDto`: `{ patient\_id: string, suivi\_id: string, type\_exploration: string, examen\_demande: string, destinataire: string, urgence: "Normal" | "Urgent" | "Très Urgent", user\_instructions?: string }`

\- `GenerateCertificatDto`: `{ patient\_id: string, suivi\_id: string, type\_certificat: "Aptitude" | "Arrêt de travail" | "Certificat de constatation" | "Certificat de décès", date\_debut?: string, date\_fin?: string, destinataire: string, user\_instructions?: string }`



Also define the output types:

\- `OrientationLetterOutput`: `{ contenu\_lettre: string, raison: string, examen\_demande: string, urgence: string }`

\- `CertificatOutput`: `{ contenu\_certificat: string, diagnostic: string, notes: string }`



\### 2. `packages/api/src/modules/ai/document-generator/repo.ts`

\- Inject the existing `getFullPatientData(patient\_id)` from the `qna` module's AiRepository (or duplicate/import it — follow whatever pattern the existing modules use)

\- Add a method `getSuiviDetails(suivi\_id)` that fetches the specific follow-up record including its linked `examen\_consultation` entries



\### 3. `packages/api/src/modules/ai/document-generator/service.ts`

Implement two methods:



\*\*`generateOrientationLetter(dto: GenerateOrientationLetterDto)`\*\*

\- Fetch full patient context via repo

\- Build a system prompt in French:

Vous êtes un assistant médical spécialisé dans la rédaction de lettres d'orientation médicale en français.

Vous rédigez des lettres professionnelles, précises et conformes aux standards médicaux français.

Basez-vous UNIQUEMENT sur les données cliniques fournies. Ne jamais inventer des informations.

Répondez UNIQUEMENT en JSON valide sans backticks ni markdown.

\- Build user message combining patient context markdown + dto fields

\- Instruct the model to return JSON matching `OrientationLetterOutput`

\- Call Gemini via Vercel AI SDK (`generateText`)

\- Parse and return the JSON output



\*\*`generateCertificat(dto: GenerateCertificatDto)`\*\*

\- Same pattern, but with a system prompt oriented toward medical certificates:

Vous êtes un assistant médical spécialisé dans la rédaction de certificats médicaux en français.

Rédigez un certificat médical professionnel de type: \[type\_certificat].

Le contenu doit être factuel, concis et juridiquement approprié selon le droit médical français.

Répondez UNIQUEMENT en JSON valide sans backticks ni markdown.





\- Return JSON matching `CertificatOutput`



\### 4. `packages/api/src/modules/ai/document-generator/router.ts`

Expose two protected tRPC procedures:

\- `ai.generateOrientationLetter` — input: `GenerateOrientationLetterDto`, calls service, returns `OrientationLetterOutput`

\- `ai.generateCertificat` — input: `GenerateCertificatDto`, calls service, returns `CertificatOutput`



Follow the exact same auth middleware pattern used in the other AI routers (protected procedure, session check, etc.).



\### 5. Register the router

Add the new router to the main `aiRouter` in `packages/api/src/modules/ai/index.ts` (or wherever the AI sub-routers are merged).



\## Testing Script

Create `apps/server/scripts/test-document-generator.ts` — a standalone Bun script that:

1\. Imports the service directly (bypassing tRPC)

2\. Uses a hardcoded `patient\_id` and `suivi\_id` (leave as TODO placeholders like `"REPLACE\_WITH\_REAL\_ID"`)

3\. Calls both `generateOrientationLetter` and `generateCertificat`

4\. Pretty-prints the JSON output to console



This lets the developer test the AI output immediately without needing a frontend.



\## Important Constraints

\- Follow ALL existing patterns exactly — don't introduce new libraries or patterns

\- French language throughout all prompts and generated content

\- The AI output must be strict JSON parseable — add a JSON.parse safety wrapper with a fallback error

\- Use `generateText` (not streaming) for simplicity — the doctor waits for the full draft before reviewing

\- Do NOT implement the DB save step — that's handled by a separate save procedure after the doctor reviews the draft

