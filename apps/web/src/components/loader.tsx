import { Loader2 } from "lucide-react";

import Sidebar from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function RoutePendingSkeleton() {
  return (
    <div className="flex min-h-svh bg-[#f3f7fb]">
      <Sidebar />
      <main className="flex-1 overflow-hidden px-[clamp(1.25rem,2.3vw,2.2rem)] py-[clamp(0.875rem,1.6vw,1.5rem)]">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
          <Skeleton className="h-[136px] rounded-[15px]" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="space-y-4">
              <Skeleton className="h-[52px] rounded-[14px]" />
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-[86px] rounded-[16px]" />
              ))}
            </div>
            <div className="space-y-4">
              <Skeleton className="h-[260px] rounded-[16px]" />
              <Skeleton className="h-[220px] rounded-[16px]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
