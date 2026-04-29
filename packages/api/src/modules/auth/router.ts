import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { authService } from "./service";

const updateMyProfileInputSchema = z.object({
  nom: z.string().trim().min(1).max(255).optional(),
  prenom: z.string().trim().min(1).max(255).optional(),
  titre: z.string().trim().min(1).max(64).optional(),
  specialite: z.string().trim().min(1).max(255).optional().nullable(),
  avatar_url: z.string().trim().url().optional().nullable(),
  telephone: z.string().trim().min(1).max(32).optional(),
  adresse: z.string().trim().min(1).optional(),
  langue_interface: z.enum(["fr", "ar", "en"]).optional(),
});

const updateMobileProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  title: z.string().trim().min(1).max(64).optional(),
  specialty: z.string().trim().min(1).max(255).optional().nullable(),
  avatar_url: z.string().trim().url().optional().nullable(),
  telephone: z.string().trim().min(1).max(32).optional(),
  adresse: z.string().trim().min(1).optional(),
});

const changePasswordInputSchema = z.object({
  currentPassword: z.string().trim().min(1).max(255),
  newPassword: z.string().trim().min(6).max(255),
});

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    return authService.getMyProfile({
      db: ctx.db,
      session: ctx.session,
    });
  }),
  getMobileProfile: protectedProcedure.query(async ({ ctx }) => {
    return authService.getMobileProfile({
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
  updateProfile: protectedProcedure
    .input(updateMobileProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.updateMobileProfile({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.changePassword({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
});
