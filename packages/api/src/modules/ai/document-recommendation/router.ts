import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import {
  generateOrientationLetterInputSchema,
  generateCertificatInputSchema,
} from "./schema";
import { documentRecommendationService } from "./service";

export const documentRecommendationRouter = createTRPCRouter({
  generateOrientationLetter: protectedProcedure
    .input(generateOrientationLetterInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      return documentRecommendationService.generateOrientationLetter({
        db: ctx.db,
        session: ctx.session,
        input,
        doctorUserId: userId,
      });
    }),

  generateCertificat: protectedProcedure
    .input(generateCertificatInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      return documentRecommendationService.generateCertificat({
        db: ctx.db,
        session: ctx.session,
        input,
        doctorUserId: userId,
      });
    }),
});
