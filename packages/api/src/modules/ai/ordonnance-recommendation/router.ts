import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { ordonnanceRecommendationService } from "./service";

const generateOrdonnanceRecommendationInputSchema = z.object({
  suivi_id: z.string().uuid(),
  examen_id: z.string().uuid().optional(),
  include_historical_context: z.boolean().optional(),
  max_historical_suivis: z.number().int().min(0).max(10).optional(),
  max_historical_treatments: z.number().int().min(1).max(15).optional(),
  clinical_problem_override: z.string().trim().min(1).max(280).nullable().optional(),
});

export const ordonnanceRecommendationRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(generateOrdonnanceRecommendationInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ordonnanceRecommendationService.generate({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
});
