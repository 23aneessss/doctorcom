import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { aiSettingsService } from "./service";

const preferredProviderSchema = z.enum(["gemini", "ollama"]);

const updateAISettingsInputSchema = z.object({
  preferred_provider: preferredProviderSchema.optional(),
  gemini_api_key: z.string().trim().min(1).optional().nullable(),
  clear_gemini_api_key: z.boolean().optional(),
});

export const aiSettingsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    return aiSettingsService.getSettings(ctx.db);
  }),
  update: protectedProcedure
    .input(updateAISettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      return aiSettingsService.updateSettings(ctx.db, input);
    }),
  downloadLocalModel: protectedProcedure.mutation(async ({ ctx }) => {
    return aiSettingsService.downloadLocalModel(ctx.db);
  }),
  deleteLocalModel: protectedProcedure.mutation(async ({ ctx }) => {
    return aiSettingsService.deleteLocalModel(ctx.db);
  }),
});
