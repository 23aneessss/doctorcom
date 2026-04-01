import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

import { TRPC_URL } from "./config";
import { trpc } from "./trpc";

interface TRPCProviderProps {
  children: React.ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            retry: false,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: TRPC_URL,
          fetch:
            Platform.OS !== "web"
              ? undefined
              : function (url, options) {
                  return fetch(url, {
                    ...options,
                    credentials: "include",
                  });
                },
          headers() {
            if (Platform.OS === "web") {
              return {};
            }

            const cookies = authClient.getCookie();
            return cookies ? { Cookie: cookies } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
