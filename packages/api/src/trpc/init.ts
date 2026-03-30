import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import type { TRPCContext } from "./context";

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
        message:
          "La requete recue par le serveur est invalide. Reessaie avec une saisie plus simple.",
      };
    }

    return shape;
  },
});

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
