import { authRouter } from "../modules/auth/router";
import { patientRouter } from "../modules/patient/router";
import { consultationRouter } from "../modules/consultation/router";
import { ordonnanceRouter } from "../modules/ordonnance/router";
import { agendaRouter } from "../modules/agenda/router";
import { medicalHistoryRouter } from "../modules/medical-history/router";
import { vaccinationRouter } from "../modules/vaccination/router";
import { travelRouter } from "../modules/travel/router";
import { documentsRouter } from "../modules/documents/router";
import { treatmentRouter } from "../modules/treatment/router";
import { exportRouter } from "../modules/export/router";
import { aiRouter } from "../modules/ai-q&a/router";
import { createTRPCRouter } from "./init";

export const appRouter = createTRPCRouter({
  agenda: agendaRouter,
  ai: aiRouter,
  auth: authRouter,
  consultation: consultationRouter,
  documents: documentsRouter,
  export: exportRouter,
  medicalHistory: medicalHistoryRouter,
  ordonnance: ordonnanceRouter,
  patient: patientRouter,
  travel: travelRouter,
  treatment: treatmentRouter,
  vaccination: vaccinationRouter,
});

export type AppRouter = typeof appRouter;
