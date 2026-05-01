// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";

import { Sidebar } from "@/components/sidebar";

export const Route = createFileRoute("/sidebar-test")({
  component: SidebarTestRoute,
});

function SidebarTestRoute() {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        currentUser={{
          name: "Dr. Ballerina Cappucina",
          email: "BallerinaCappuc@gmail.com",
        }}
      />
      <main className="flex-1 overflow-auto p-8">
        <h1 className="text-2xl font-semibold">Sidebar Test Page</h1>
        <p className="mt-2 text-muted-foreground">Open DevTools inspector to verify layout and styles.</p>
      </main>
    </div>
  );
}
