import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/antecedent")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Antécédents</h2>
    </div>
  );
}