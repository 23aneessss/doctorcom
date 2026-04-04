import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/info-sociale")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Informations Sociales</h2>
    </div>
  );
}