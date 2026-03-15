import { trpc } from "../init";

export const auditMiddleware = trpc.middleware(async ({ next }) => {
  return next();
});
