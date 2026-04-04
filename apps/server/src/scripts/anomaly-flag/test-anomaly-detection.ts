import "dotenv/config";

import "../load-env";

// Manual HTTP request examples and payload shape notes:
// packages/api/src/modules/ai/anomaly-flag/agent-test.md

import type { AppRouter } from "@doctor.com/api/routers/index";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import {
  prepareAnomalyTestFixtures,
} from "./test-fixtures";

interface ScenarioOutcome {
  key: string;
  title: string;
  expectedCodes: string[];
  observedCodes: string[];
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  required: boolean;
}

interface SummaryStats {
  pass: number;
  fail: number;
  skip: number;
  total: number;
  blockingFailures: ScenarioOutcome[];
}

interface CheckPrescriptionResult {
  anomalies_par_medicament: { code: string }[];
  anomalies_globales: { code: string }[];
  ai_available: boolean;
}

interface TrpcLikeError {
  message?: string;
  data?: {
    code?: string;
  };
}

function normalizeCodes(codes: string[]): string[] {
  return Array.from(new Set(codes)).sort((a, b) => a.localeCompare(b));
}

function extractCodes(result: CheckPrescriptionResult): string[] {
  return normalizeCodes([
    ...result.anomalies_par_medicament.map((item) => item.code),
    ...result.anomalies_globales.map((item) => item.code),
  ]);
}

function includesAllCodes(observed: string[], expected: string[]): boolean {
  return expected.every((code) => observed.includes(code));
}

function formatCodes(codes: string[]): string {
  return codes.length > 0 ? codes.join(", ") : "(aucun)";
}

async function runReseedFlow(): Promise<void> {
  const steps = [
    ["bun", "run", "db:reset"],
    ["bun", "run", "db:seed"],
    ["bun", "run", "medications-db:seed"],
  ];

  for (const step of steps) {
    const commandLabel = step.join(" ");
    console.log(`\n[reseed] ${commandLabel}`);
    const proc = Bun.spawnSync(step, {
      stdout: "inherit",
      stderr: "inherit",
    });

    if (proc.exitCode !== 0) {
      throw new Error(`La commande a echoue: ${commandLabel}`);
    }
  }
}

function resolveServerUrl(): string {
  const fallbackPort = process.env.PORT ?? "3000";
  const raw =
    process.env.ANOMALY_TEST_SERVER_URL ?? `http://localhost:${fallbackPort}`;
  return raw.replace(/\/$/, "");
}

function getSetCookieValues(headers: Headers): string[] {
  const enhanced = headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
    getAll?: (name: string) => string[];
  };

  if (typeof enhanced.getSetCookie === "function") {
    return enhanced.getSetCookie();
  }
  if (typeof enhanced.raw === "function") {
    return enhanced.raw()["set-cookie"] ?? [];
  }
  if (typeof enhanced.getAll === "function") {
    return enhanced.getAll("set-cookie");
  }

  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,\s]+=)/g);
}

function extractCookieHeader(setCookieValues: string[]): string {
  const cookiePairs = setCookieValues
    .map((value) => value.split(";")[0]?.trim())
    .filter((value): value is string => Boolean(value));

  return cookiePairs.join("; ");
}

async function ensureServerReachable(serverUrl: string): Promise<void> {
  const response = await fetch(`${serverUrl}/`);
  if (!response.ok) {
    throw new Error(
      `Serveur injoignable sur ${serverUrl} (status ${response.status}). Demarrez-le avec bun run dev:server.`,
    );
  }
}

async function signInAndGetCookie(params: {
  serverUrl: string;
  email: string;
  password: string;
}): Promise<string> {
  const response = await fetch(`${params.serverUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Echec de login HTTP (${response.status}). Verifiez ANOMALY_TEST_EMAIL/ANOMALY_TEST_PASSWORD. Reponse: ${body}`,
    );
  }

  const setCookies = getSetCookieValues(response.headers);
  const cookieHeader = extractCookieHeader(setCookies);
  if (!cookieHeader) {
    throw new Error(
      "Login reussi mais aucun cookie de session recu. Impossible d'appeler les procedures protegees.",
    );
  }

  return cookieHeader;
}

function createHttpTrpcClient(params: {
  serverUrl: string;
  cookieHeader?: string;
}) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${params.serverUrl}/trpc`,
        headers() {
          if (!params.cookieHeader) {
            return {};
          }
          return {
            Cookie: params.cookieHeader,
          };
        },
      }),
    ],
  });
}

async function executeScenario(params: {
  key: string;
  title: string;
  expectedCodes: string[];
  required?: boolean;
  skipReason?: string;
  client: ReturnType<typeof createHttpTrpcClient>;
  patientId: string;
  medicaments: {
    medicament_externe_id: string;
    dosage?: string;
    posologie: string;
    duree_traitement?: string;
  }[];
}): Promise<ScenarioOutcome> {
  if (params.skipReason) {
    return {
      key: params.key,
      title: params.title,
      expectedCodes: params.expectedCodes,
      observedCodes: [],
      status: "SKIP",
      details: params.skipReason,
      required: params.required ?? true,
    };
  }

  const result = (await params.client.ai.anomalyFlag.checkPrescription.mutate({
    patient_id: params.patientId,
    medicaments: params.medicaments,
  })) as CheckPrescriptionResult;

  const observedCodes = extractCodes(result);
  const pass = includesAllCodes(observedCodes, params.expectedCodes);

  return {
    key: params.key,
    title: params.title,
    expectedCodes: params.expectedCodes,
    observedCodes,
    status: pass ? "PASS" : "FAIL",
    details: pass
      ? "Codes attendus detectes."
      : `Codes manquants: ${formatCodes(params.expectedCodes.filter((code) => !observedCodes.includes(code)))}`,
    required: params.required ?? true,
  };
}

function extractTrpcError(error: unknown): {
  code: string;
  message: string;
} {
  const err = error as TrpcLikeError;

  return {
    code: err.data?.code ?? "UNKNOWN",
    message: err.message ?? "Erreur inconnue",
  };
}

async function executeNegativeScenario(params: {
  key: string;
  title: string;
  client: ReturnType<typeof createHttpTrpcClient>;
  input: unknown;
  expectedErrorCode: string;
  expectedMessageIncludes?: string[];
  required?: boolean;
}): Promise<ScenarioOutcome> {
  try {
    await params.client.ai.anomalyFlag.checkPrescription.mutate(
      params.input as never,
    );
    return {
      key: params.key,
      title: params.title,
      expectedCodes: [params.expectedErrorCode],
      observedCodes: ["NO_ERROR"],
      status: "FAIL",
      details: "La requete devait echouer, mais elle a reussi.",
      required: params.required ?? true,
    };
  } catch (error) {
    const parsed = extractTrpcError(error);
    const codeOk = parsed.code === params.expectedErrorCode;

    const msgOk =
      (params.expectedMessageIncludes ?? []).every((fragment) =>
        parsed.message.includes(fragment),
      );

    const pass = codeOk && msgOk;

    return {
      key: params.key,
      title: params.title,
      expectedCodes: [params.expectedErrorCode],
      observedCodes: [parsed.code],
      status: pass ? "PASS" : "FAIL",
      details: pass
        ? `Erreur attendue detectee (${parsed.code}).`
        : `Erreur inattendue. code=${parsed.code}, message=${parsed.message}`,
      required: params.required ?? true,
    };
  }
}

async function executeForbiddenCodeScenario(params: {
  key: string;
  title: string;
  forbiddenCodes: string[];
  required?: boolean;
  skipReason?: string;
  client: ReturnType<typeof createHttpTrpcClient>;
  patientId: string;
  medicaments: {
    medicament_externe_id: string;
    dosage?: string;
    posologie: string;
    duree_traitement?: string;
  }[];
}): Promise<ScenarioOutcome> {
  if (params.skipReason) {
    return {
      key: params.key,
      title: params.title,
      expectedCodes: params.forbiddenCodes,
      observedCodes: [],
      status: "SKIP",
      details: params.skipReason,
      required: params.required ?? true,
    };
  }

  const result = (await params.client.ai.anomalyFlag.checkPrescription.mutate({
    patient_id: params.patientId,
    medicaments: params.medicaments,
  })) as CheckPrescriptionResult;

  const observedCodes = extractCodes(result);
  const triggeredForbidden = params.forbiddenCodes.filter((code) =>
    observedCodes.includes(code),
  );

  return {
    key: params.key,
    title: params.title,
    expectedCodes: params.forbiddenCodes,
    observedCodes,
    status: triggeredForbidden.length === 0 ? "PASS" : "FAIL",
    details:
      triggeredForbidden.length === 0
        ? "Aucun code interdit detecte."
        : `Codes interdits detectes: ${triggeredForbidden.join(", ")}`,
    required: params.required ?? true,
  };
}

function printTable(outcomes: ScenarioOutcome[]): void {
  console.log("\n# Resultats des scenarios");
  for (const item of outcomes) {
    console.log(`\n[${item.status}] ${item.key} - ${item.title}`);
    console.log(`  expected: ${formatCodes(item.expectedCodes)}`);
    console.log(`  observed: ${formatCodes(item.observedCodes)}`);
    console.log(`  details : ${item.details}`);
  }
}

function buildSummary(outcomes: ScenarioOutcome[]): SummaryStats {
  const pass = outcomes.filter((item) => item.status === "PASS").length;
  const fail = outcomes.filter((item) => item.status === "FAIL").length;
  const skip = outcomes.filter((item) => item.status === "SKIP").length;
  const blockingFailures = outcomes.filter(
    (item) => item.status === "FAIL" && item.required,
  );

  return {
    pass,
    fail,
    skip,
    total: outcomes.length,
    blockingFailures,
  };
}

function printSummary(summary: SummaryStats): void {
  console.log("\n# Summary");
  console.log(`- PASS: ${summary.pass}`);
  console.log(`- FAIL: ${summary.fail}`);
  console.log(`- SKIP: ${summary.skip}`);
  console.log(`- TOTAL: ${summary.total}`);

  if (summary.blockingFailures.length > 0) {
    console.log("\nEchecs bloquants:");
    for (const item of summary.blockingFailures) {
      console.log(`- ${item.key} (${item.title})`);
    }
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const useJsonOutput = args.has("--json");
  const shouldReseed = args.has("--reseed");
  const shouldPrepare = !args.has("--no-prepare");

  if (shouldReseed) {
    await runReseedFlow();
  }

  if (!shouldPrepare) {
    throw new Error(
      "Le script attend la preparation des fixtures. Lancez sans --no-prepare.",
    );
  }

  const serverUrl = resolveServerUrl();
  const loginEmail = process.env.ANOMALY_TEST_EMAIL ?? "tbib@doctorcom.com";
  const loginPassword = process.env.ANOMALY_TEST_PASSWORD ?? "doctor123!";

  await ensureServerReachable(serverUrl);

  const fixtures = await prepareAnomalyTestFixtures({
    userEmail: loginEmail,
  });

  const cookieHeader = await signInAndGetCookie({
    serverUrl,
    email: loginEmail,
    password: loginPassword,
  });
  const client = createHttpTrpcClient({ serverUrl, cookieHeader });
  const unauthenticatedClient = createHttpTrpcClient({ serverUrl });

  console.log("# Fixtures");
  console.log(`- server: ${serverUrl}`);
  console.log(`- auth email: ${loginEmail}`);
  console.log(`- utilisateur: ${fixtures.utilisateur.email} (${fixtures.utilisateur.id})`);
  console.log(`- patient femaleRisk: ${fixtures.patients.femaleRisk.id}`);
  console.log(`- patient child: ${fixtures.patients.child.id}`);
  console.log(`- patient chronic: ${fixtures.patients.chronic.id}`);
  console.log(`- patient semanticNegative: ${fixtures.patients.semanticNegative.id}`);
  console.log("- meds selection:");
  console.log(
    `  - pregnancy: ${fixtures.medications.pregnancy ? `${fixtures.medications.pregnancy.id} (${fixtures.medications.pregnancy.nom_medicament})` : "n/a"}`,
  );
  console.log(
    `  - breastfeeding: ${fixtures.medications.breastfeeding ? `${fixtures.medications.breastfeeding.id} (${fixtures.medications.breastfeeding.nom_medicament})` : "n/a"}`,
  );
  console.log(
    `  - childNoPediatricDosage: ${fixtures.medications.childNoPediatricDosage ? `${fixtures.medications.childNoPediatricDosage.id} (${fixtures.medications.childNoPediatricDosage.nom_medicament})` : "n/a"}`,
  );
  console.log(
    `  - contreIndication: ${fixtures.medications.contreIndication ? `${fixtures.medications.contreIndication.id} (${fixtures.medications.contreIndication.nom_medicament})` : "n/a"}`,
  );
  console.log(
    `  - precaution: ${fixtures.medications.precaution ? `${fixtures.medications.precaution.id} (${fixtures.medications.precaution.nom_medicament})` : "n/a"}`,
  );
  console.log(
    `  - interactionPair: ${fixtures.medications.interactionPair ? `${fixtures.medications.interactionPair.medicationA.id}/${fixtures.medications.interactionPair.medicationB.id}` : "n/a"}`,
  );

  const outcomes: ScenarioOutcome[] = [];

  outcomes.push(
    await executeScenario({
      key: "S1",
      title: "Pregnancy contraindication",
      expectedCodes: ["PREGNANCY_CONTRAINDICATION"],
      client,
      patientId: fixtures.patients.femaleRisk.id,
      skipReason: fixtures.medications.pregnancy
        ? undefined
        : "Aucun medicament cible pour grossesse.",
      medicaments: fixtures.medications.pregnancy
        ? [
            {
              medicament_externe_id: String(fixtures.medications.pregnancy.id),
              posologie: "1 prise par jour",
              dosage: "standard",
              duree_traitement: "7 jours",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S2",
      title: "Breastfeeding risk",
      expectedCodes: ["BREASTFEEDING_RISK"],
      client,
      patientId: fixtures.patients.femaleRisk.id,
      skipReason: fixtures.medications.breastfeeding
        ? undefined
        : "Aucun medicament cible pour allaitement.",
      medicaments: fixtures.medications.breastfeeding
        ? [
            {
              medicament_externe_id: String(fixtures.medications.breastfeeding.id),
              posologie: "1 prise par jour",
              dosage: "standard",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S3",
      title: "Child without pediatric dosage",
      expectedCodes: ["CHILD_NO_PEDIATRIC_DOSAGE"],
      client,
      patientId: fixtures.patients.child.id,
      skipReason: fixtures.medications.childNoPediatricDosage
        ? undefined
        : "Aucun medicament sans posologie pediatrique trouve.",
      medicaments: fixtures.medications.childNoPediatricDosage
        ? [
            {
              medicament_externe_id: String(
                fixtures.medications.childNoPediatricDosage.id,
              ),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S4",
      title: "Contre-indication match",
      expectedCodes: ["CONTRE_INDICATION_MATCH"],
      client,
      patientId: fixtures.patients.chronic.id,
      skipReason: fixtures.medications.contreIndication
        ? undefined
        : "Aucun candidat contre-indication trouve.",
      medicaments: fixtures.medications.contreIndication
        ? [
            {
              medicament_externe_id: String(
                fixtures.medications.contreIndication.id,
              ),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S5",
      title: "Precaution match",
      expectedCodes: ["PRECAUTION_MATCH"],
      client,
      patientId: fixtures.patients.chronic.id,
      skipReason: fixtures.medications.precaution
        ? undefined
        : "Aucun candidat precaution trouve.",
      medicaments: fixtures.medications.precaution
        ? [
            {
              medicament_externe_id: String(fixtures.medications.precaution.id),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S6",
      title: "Drug interaction within prescription",
      expectedCodes: ["DRUG_INTERACTION"],
      client,
      patientId: fixtures.patients.chronic.id,
      skipReason: fixtures.medications.interactionPair
        ? undefined
        : "Aucune paire d'interaction interne trouvee.",
      medicaments: fixtures.medications.interactionPair
        ? [
            {
              medicament_externe_id: String(
                fixtures.medications.interactionPair.medicationA.id,
              ),
              posologie: "1 prise par jour",
            },
            {
              medicament_externe_id: String(
                fixtures.medications.interactionPair.medicationB.id,
              ),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S7",
      title: "Existing treatment interaction",
      expectedCodes: ["EXISTING_TREATMENT_INTERACTION"],
      client,
      patientId: fixtures.patients.chronic.id,
      skipReason: fixtures.medications.interactionPair
        ? undefined
        : "Pas de traitement actif interactionnel disponible.",
      medicaments: fixtures.medications.interactionPair
        ? [
            {
              medicament_externe_id: String(
                fixtures.medications.interactionPair.medicationA.id,
              ),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeScenario({
      key: "S8",
      title: "Medication not found",
      expectedCodes: ["MEDICATION_NOT_FOUND"],
      client,
      patientId: fixtures.patients.chronic.id,
      medicaments: [
        {
          medicament_externe_id: "99999999",
          posologie: "1 prise par jour",
        },
      ],
    }),
  );

  const aiResult = (await client.ai.anomalyFlag.checkPrescription.mutate({
    patient_id: fixtures.patients.chronic.id,
    medicaments: [
      {
        medicament_externe_id: "99999999",
        posologie: "1 prise par jour",
      },
    ],
  })) as CheckPrescriptionResult;

  outcomes.push({
    key: "S9",
    title: "AI availability flag",
    expectedCodes: [],
    observedCodes: extractCodes(aiResult),
    status: process.env.MISTRAL_API_KEY
      ? "PASS"
      : aiResult.ai_available === false
        ? "PASS"
        : "FAIL",
    details: process.env.MISTRAL_API_KEY
      ? `MISTRAL_API_KEY configuree, ai_available=${aiResult.ai_available}.`
      : `MISTRAL_API_KEY absente, ai_available=${aiResult.ai_available} (attendu: false).`,
    required: false,
  });

  outcomes.push(
    await executeForbiddenCodeScenario({
      key: "S10",
      title: "CI does not apply to patient",
      forbiddenCodes: ["CONTRE_INDICATION_MATCH", "PRECAUTION_MATCH"],
      client,
      patientId: fixtures.patients.semanticNegative.id,
      skipReason: fixtures.medications.contreIndication
        ? undefined
        : "Aucun candidat contre-indication disponible.",
      medicaments: fixtures.medications.contreIndication
        ? [
            {
              medicament_externe_id: String(
                fixtures.medications.contreIndication.id,
              ),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeForbiddenCodeScenario({
      key: "S11",
      title: "Precaution does not apply to patient",
      forbiddenCodes: ["CONTRE_INDICATION_MATCH", "PRECAUTION_MATCH"],
      client,
      patientId: fixtures.patients.semanticNegative.id,
      skipReason: fixtures.medications.precaution
        ? undefined
        : "Aucun candidat precaution disponible.",
      medicaments: fixtures.medications.precaution
        ? [
            {
              medicament_externe_id: String(fixtures.medications.precaution.id),
              posologie: "1 prise par jour",
            },
          ]
        : [],
    }),
  );

  outcomes.push(
    await executeNegativeScenario({
      key: "N1",
      title: "Invalid patient_id UUID",
      client,
      expectedErrorCode: "BAD_REQUEST",
      input: {
        patient_id: "invalid-uuid",
        medicaments: [
          {
            medicament_externe_id: "6",
            posologie: "1 prise par jour",
          },
        ],
      },
    }),
  );

  outcomes.push(
    await executeNegativeScenario({
      key: "N2",
      title: "Empty medicaments array",
      client,
      expectedErrorCode: "BAD_REQUEST",
      expectedMessageIncludes: ["Au moins un medicament est requis."],
      input: {
        patient_id: fixtures.patients.chronic.id,
        medicaments: [],
      },
    }),
  );

  const tooManyMedicaments = Array.from({ length: 21 }, (_, index) => ({
    medicament_externe_id: String(100000 + index),
    posologie: "1 prise par jour",
  }));

  outcomes.push(
    await executeNegativeScenario({
      key: "N3",
      title: "More than 20 medicaments",
      client,
      expectedErrorCode: "BAD_REQUEST",
      expectedMessageIncludes: ["Maximum 20 medicaments par verification."],
      input: {
        patient_id: fixtures.patients.chronic.id,
        medicaments: tooManyMedicaments,
      },
    }),
  );

  outcomes.push(
    await executeNegativeScenario({
      key: "N4",
      title: "Blank medicament_externe_id",
      client,
      expectedErrorCode: "BAD_REQUEST",
      expectedMessageIncludes: ["medicament_externe_id"],
      input: {
        patient_id: fixtures.patients.chronic.id,
        medicaments: [
          {
            medicament_externe_id: "   ",
            posologie: "1 prise par jour",
          },
        ],
      },
    }),
  );

  outcomes.push(
    await executeNegativeScenario({
      key: "N5",
      title: "Blank posologie",
      client,
      expectedErrorCode: "BAD_REQUEST",
      expectedMessageIncludes: ["posologie"],
      input: {
        patient_id: fixtures.patients.chronic.id,
        medicaments: [
          {
            medicament_externe_id: "6",
            posologie: "   ",
          },
        ],
      },
    }),
  );

  outcomes.push(
    await executeNegativeScenario({
      key: "N6",
      title: "Unauthenticated request",
      client: unauthenticatedClient,
      expectedErrorCode: "UNAUTHORIZED",
      input: {
        patient_id: fixtures.patients.chronic.id,
        medicaments: [
          {
            medicament_externe_id: "6",
            posologie: "1 prise par jour",
          },
        ],
      },
    }),
  );

  const summary = buildSummary(outcomes);

  if (useJsonOutput) {
    console.log(JSON.stringify({ outcomes, summary }, null, 2));
  } else {
    printTable(outcomes);
    printSummary(summary);
  }

  if (summary.blockingFailures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Echec du test anomaly-flag:", error);
  process.exit(1);
});
