import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/sante-feminine")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Santé Féminine</h2>
    </div>
  );
}