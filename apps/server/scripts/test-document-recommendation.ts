/**
 * Standalone test script for the document-recommendation AI module.
 *
 * Usage:
 *   bun run apps/server/scripts/test-document-recommendation.ts
 *
 * Prerequisites:
 *   - PostgreSQL running with a seeded database
 *   - GEMINI_API_KEY set in apps/server/.env
 *   - Replace the placeholder IDs below with real values from your DB
 */

import { db } from "@doctor.com/db";
import { DocumentRecommendationService } from "../../../packages/api/src/modules/ai/document-recommendation/service";

// ---- Replace these with real IDs from your database ----
const PATIENT_ID = "a0000000-0000-4000-a000-000000000001";
const SUIVI_ID = "e0000000-0000-4000-a000-000000000001";
const USER_ID = "9c9b18f8-e89a-4b32-b387-e39f96d0f9e8";
const USER_EMAIL = "tbib@doctorcom.com";

// Fake session matching the shape of SessionUtilisateur
const fakeSession = {
  user: {
    id: USER_ID,
    email: USER_EMAIL,
    name: "Dr. Test",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
  },
  session: {
    id: "fake-session-id",
    userId: USER_ID,
    token: "fake-token",
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
  },
} as any;

const service = new DocumentRecommendationService();

async function testOrientationLetter() {
  console.log("\n========================================");
  console.log("  TEST: Orientation Letter Generation");
  console.log("========================================\n");

  try {
    const result = await service.generateOrientationLetter({
      db,
      session: fakeSession,
      input: {
        patient_id: PATIENT_ID,
        suivi_id: SUIVI_ID,
        type_exploration: "Radiologie",
        examen_demande: "IRM cerebrale avec injection de gadolinium",
        destinataire: "Service de Radiologie - CHU",
        urgence: "urgente",
        user_instructions: "Le patient presente des cephalees persistantes depuis 3 semaines.",
      },
      doctorUserId: USER_ID,
    });

    console.log("✅ Orientation letter generated successfully!\n");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Orientation letter generation failed:\n", error);
  }
}

async function testCertificat() {
  console.log("\n========================================");
  console.log("  TEST: Certificat Medical Generation");
  console.log("========================================\n");

  try {
    const result = await service.generateCertificat({
      db,
      session: fakeSession,
      input: {
        patient_id: PATIENT_ID,
        suivi_id: SUIVI_ID,
        type_certificat: "arret_travail",
        date_debut: "2026-04-25",
        date_fin: "2026-05-02",
        destinataire: "Employeur",
      },
      doctorUserId: USER_ID,
    });

    console.log("✅ Certificat medical generated successfully!\n");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Certificat generation failed:\n", error);
  }
}

async function main() {
  console.log("🩺 Document Recommendation AI Module — Test Script\n");

  if (PATIENT_ID.startsWith("REPLACE")) {
    console.warn("⚠️  Please replace PATIENT_ID, SUIVI_ID, and session fields with real values from your DB.\n");
    process.exit(1);
  }

  await testOrientationLetter();
  await testCertificat();

  console.log("\n✅ All tests completed.");
  process.exit(0);
}

main();
