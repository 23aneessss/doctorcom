import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@doctor.com/api/routers/index";

export const trpc = createTRPCReact<AppRouter>();
