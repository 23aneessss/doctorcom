import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { mobileTodayService } from "./service";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu : YYYY-MM-DD.");

export const mobileTodayRouter = createTRPCRouter({
  getSummary: protectedProcedure
    .input(
      z
        .object({
          date: dateSchema.optional(),
        })
        .optional()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      return mobileTodayService.getSummary({
        db: ctx.db,
        session: ctx.session,
        date: input.date ?? new Date().toISOString().slice(0, 10),
      });
    }),
  getQuickStats: protectedProcedure.query(async ({ ctx }) => {
    return mobileTodayService.getQuickStats({
      db: ctx.db,
      session: ctx.session,
    });
  }),
});
