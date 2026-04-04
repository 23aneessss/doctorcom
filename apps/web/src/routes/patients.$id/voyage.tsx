import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/voyage")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Voyages</h2>
    </div>
  );
}