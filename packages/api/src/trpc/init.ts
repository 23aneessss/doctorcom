import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import type { TRPCContext } from "./context";
import { toSimpleFrenchRuntimeMessage } from "./error-messages";

export const trpc = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      const firstIssue = error.cause.issues[0];
      const path = firstIssue?.path.join(" > ");

      return {
        ...shape,
        message: path
          ? `La demande n'a pas pu etre analysee correctement (${path}). Verifie les informations saisies.`
          : "La demande n'a pas pu etre analysee correctement. Verifie les informations saisies.",
      };
    }

    if (error.code === "PARSE_ERROR") {
      return {
        ...shape,
        message: toSimpleFrenchRuntimeMessage({
          code: error.code,
          message: shape.message,
        }),
      };
    }

    return {
      ...shape,
      message: toSimpleFrenchRuntimeMessage({
        code: error.code,
        message: shape.message,
      }),
    };
  },
});

export const createTRPCRouter = trpc.router;
export const publicProcedure = trpc.procedure;
export const protectedProcedure = trpc.procedure.use(({ ctx, next }) => {
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
