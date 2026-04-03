import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { mobileFlowService } from "./service";

const moodSchema = z.enum(["excellent", "good", "average", "poor"]);

export const mobileFlowRouter = createTRPCRouter({
  startSession: protectedProcedure.mutation(async ({ ctx }) => {
    return mobileFlowService.startSession({
      db: ctx.db,
      session: ctx.session,
    });
  }),
  endSession: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        sessionNotes: z.string().trim().optional(),
        mood: moodSchema.optional(),
        focusScore: z.number().int().min(1).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return mobileFlowService.endSession({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
        sessionNotes: input.sessionNotes,
        mood: input.mood,
        focusScore: input.focusScore,
      });
    }),
  getActiveSession: protectedProcedure.query(async ({ ctx }) => {
    return mobileFlowService.getActiveSession({
      db: ctx.db,
      session: ctx.session,
    });
  }),
  getStats: protectedProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).default(7),
        })
        .default({
          days: 7,
        }),
    )
    .query(async ({ ctx, input }) => {
      return mobileFlowService.getStats({
        db: ctx.db,
        session: ctx.session,
        days: input.days,
      });
    }),
  updateNotes: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        sessionNotes: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return mobileFlowService.updateNotes({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
        sessionNotes: input.sessionNotes,
      });
    }),
});
