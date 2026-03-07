import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { authService } from "./service";

const updateMyProfileInputSchema = z.object({
  nom: z.string().trim().min(1).max(255).optional(),
  prenom: z.string().trim().min(1).max(255).optional(),
  telephone: z.string().trim().min(1).max(32).optional(),
  adresse: z.string().trim().min(1).optional(),
});

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    return authService.getMyProfile({
      db: ctx.db,
      session: ctx.session,
    });
  }),
  updateMyProfile: protectedProcedure
    .input(updateMyProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.updateMyProfile({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
});
