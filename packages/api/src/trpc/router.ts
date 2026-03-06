import { authRouter } from "../modules/auth/router";
import { patientRouter } from "../modules/patient/router";
import { consultationRouter } from "../modules/consultation/router";
import { ordonnanceRouter } from "../modules/ordonnance/router";
import { agendaRouter } from "../modules/agenda/router";
import { exportRouter } from "../modules/export/router";
import { aideRouter } from "../modules/aide/router";
import { validationRouter } from "../modules/validation/router";
import { aiRouter } from "../modules/ai/router";
import { emailRouter } from "../modules/email/router";
import { createTRPCRouter } from "./init";

export const appRouter = createTRPCRouter({
  agenda: agendaRouter,
  ai: aiRouter,
  aide: aideRouter,
  auth: authRouter,
  consultation: consultationRouter,
  email: emailRouter,
  export: exportRouter,
  ordonnance: ordonnanceRouter,
  patient: patientRouter,
  validation: validationRouter,
});

export type AppRouter = typeof appRouter;
