import { initTRPC, TRPCError } from "@trpc/server";

import type { TRPCContext } from "./context";

export const trpc = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = trpc.router;
export const publicProcedure = trpc.procedure;
export const protectedProcedure = trpc.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentification requise.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
