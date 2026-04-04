import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/document")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <h2>Documents</h2>
    </div>
  );
}