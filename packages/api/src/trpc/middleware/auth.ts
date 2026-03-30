import { TRPCError } from "@trpc/server";

import { trpc } from "../init";

export const requireAuth = trpc.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "La session a expiré. Reconnectez-vous.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
