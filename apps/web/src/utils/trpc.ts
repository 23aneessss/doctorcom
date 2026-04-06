import type { AppRouter } from "@doctor.com/api/routers/index";

import { env } from "@doctor.com/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const networkError = error.message === "Failed to fetch";

      toast.error(
        networkError
          ? `Connexion API impossible (${env.VITE_SERVER_URL}). Vérifiez le serveur et le CORS.`
          : error.message,
        {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
        },
      );
    },
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.VITE_SERVER_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
