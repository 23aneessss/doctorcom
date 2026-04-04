import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { anomalyFlagService } from "./service";

export const anomalyFlagRouter = createTRPCRouter({
  checkPrescription: protectedProcedure
    .input(
      z.object({
        patient_id: z.string().uuid(),
        medicaments: z
          .array(
            z.object({
              medicament_externe_id: z.string().trim().min(1),
              dosage: z.string().optional(),
              posologie: z.string().trim().min(1),
              duree_traitement: z.string().optional(),
            }),
          )
          .min(1, "Au moins un medicament est requis.")
          .max(20, "Maximum 20 medicaments par verification."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return anomalyFlagService.checkPrescription({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
        medicaments: input.medicaments,
      });
    }),
});
