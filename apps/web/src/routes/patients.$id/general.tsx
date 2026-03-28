import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/general")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Informations Générales</h2>
    </div>
  );
}