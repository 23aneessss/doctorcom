import { trpc } from "../init";

export const validateMiddleware = trpc.middleware(async ({ next }) => {
  return next();
});
