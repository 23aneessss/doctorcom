import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/require-session";
import { Sidebar } from "@/components/sidebar";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  return (
    <div className="flex h-svh">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
