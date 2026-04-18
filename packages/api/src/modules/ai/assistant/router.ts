import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { assistantOrchestratorService } from "./service";
import { assistantChatInputSchema } from "./schema";

export const assistantRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(assistantChatInputSchema)
    .mutation(async ({ ctx, input }) => {
      return assistantOrchestratorService.chat({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
});
