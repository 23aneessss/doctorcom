import type { AppRouter } from "@doctor.com/api/routers/index";

import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { getServerBaseUrl } from "@/lib/server-url";

const serverBaseUrl = getServerBaseUrl();

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const networkError = error.message === "Failed to fetch";

      toast.error(
        networkError
          ? `Connexion API impossible (${serverBaseUrl}). Vérifiez le serveur et le CORS.`
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
      url: `${serverBaseUrl}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpcUnbatchedClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${serverBaseUrl}/trpc`,
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
