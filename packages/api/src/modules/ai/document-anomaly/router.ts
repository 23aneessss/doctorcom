import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { documentAnomalyService } from "./service";

export const documentAnomalyRouter = createTRPCRouter({
  analyzeDocuments: protectedProcedure
    .input(
      z.object({
        patient_id: z.string().uuid(),
        document_keys: z
          .array(z.string().trim().min(1))
          .min(1, "Au moins un document est requis.")
          .max(10, "Maximum 10 documents par analyse."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return documentAnomalyService.analyzeDocuments({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
        document_keys: input.document_keys,
      });
    }),
});
