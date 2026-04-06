import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/aide/faq")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  return (
    <div>
      <h1>FAQ - Foire Aux Questions</h1>
    </div>
  );
}
