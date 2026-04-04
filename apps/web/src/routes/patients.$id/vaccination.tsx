import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/vaccination")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Vaccinations</h2>
    </div>
  );
}