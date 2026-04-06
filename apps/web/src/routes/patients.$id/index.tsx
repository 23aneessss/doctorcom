import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/patients/$id/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/patients/$id/general",
      params: { id: params.id },
    });
  },
  component: () => null,
});
