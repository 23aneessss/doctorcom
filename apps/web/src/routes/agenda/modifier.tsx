import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/agenda/modifier")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  return (
    <div>
      <h1>Modifier un Rendez-vous</h1>
    </div>
  );
}
