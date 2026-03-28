import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/suivi")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Suivi</h2>
    </div>
  );
}