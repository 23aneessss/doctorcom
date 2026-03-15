import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { aiService } from "./service";

export const aiRouter = createTRPCRouter({
  ask: protectedProcedure
    .input(
      z.object({
        patient_id: z.string().uuid(),
        question: z.string().trim().min(1).max(2000),
      }),
    )
    .query(async ({ ctx, input }) => {
      return aiService.ask({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
        question: input.question,
      });
    }),
});
