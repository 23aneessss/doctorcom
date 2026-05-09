import type { QueryClient } from "@tanstack/react-query";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { trpc } from "@/utils/trpc";

import { GlobalAIAssistant } from "@/components/ai-assistant/GlobalAIAssistant";
import { AppointmentReminderNotifier } from "@/components/appointment-reminder-notifier";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "../index.css";
import { fa } from "zod/v4/locales";

import faviconurl from "@/assets/favicon.ico";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "doctor.com",
      },
      {
        name: "description",
        content: "doctor.com is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: faviconurl,
      },
    ],
  }),
});

function RootComponent() {
  const showDevtools = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEVTOOLS === "true";

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <Outlet />
        <AppointmentReminderNotifier />
        <GlobalAIAssistant />
        <Toaster richColors />
      </ThemeProvider>
      {showDevtools ? (
        <>
          <TanStackRouterDevtools position="top-right" />
          <ReactQueryDevtools position="bottom" buttonPosition="bottom-left" />
        </>
      ) : null}
    </>
  );
}
