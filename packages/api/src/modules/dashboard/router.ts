import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { dashboardService } from "./service";

export const dashboardRouter = createTRPCRouter({
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    return dashboardService.getOverview({
      db: ctx.db,
      session: ctx.session,
    });
  }),
});
