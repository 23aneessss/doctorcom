import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { medicationAssistantService } from "./service";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const medicationAssistantChatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
  selected_medicament_ids: z
    .array(z.coerce.number().int().positive())
    .max(10)
    .optional(),
  max_candidates: z.coerce.number().int().min(3).max(20).optional(),
  max_history_messages: z.coerce.number().int().min(1).max(12).optional(),
});

export const medicationAssistantRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(medicationAssistantChatInputSchema)
    .mutation(async ({ ctx, input }) => {
      return medicationAssistantService.chat({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
});
