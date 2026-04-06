import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/require-session";

export const Route = createFileRoute("/parametres")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  return (
    <div>
      <h1>Paramètres</h1>
    </div>
  );
}
