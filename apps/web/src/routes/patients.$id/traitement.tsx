import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/traitement")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Traitements</h2>
    </div>
  );
}