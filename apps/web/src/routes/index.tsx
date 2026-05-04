import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await requireSession();
    throw redirect({ to: "/dashboard" });
  },
});
