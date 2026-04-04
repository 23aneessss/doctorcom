import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { hypotheseDiagnosticService } from "./service";

const generateHypotheseDiagnosticInputSchema = z.object({
  suivi_id: z.string().uuid(),
  examen_id: z.string().uuid().optional(),
  include_historical_context: z.boolean().optional(),
  max_historical_suivis: z.number().int().min(0).max(10).optional(),
  max_historical_treatments: z.number().int().min(1).max(15).optional(),
});

export const hypotheseDiagnosticRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(generateHypotheseDiagnosticInputSchema)
    .mutation(async ({ ctx, input }) => {
      return hypotheseDiagnosticService.generate({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
});
