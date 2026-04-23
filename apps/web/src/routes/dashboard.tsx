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
  const { session } = Route.useRouteContext();
  const sessionUser = session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;

  return (
    <div className="flex h-svh">
      <Sidebar currentUser={sidebarUser} />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
