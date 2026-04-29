import Sidebar from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

function GenericPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <Skeleton className="h-[136px] rounded-[15px]" />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-4">
          <Skeleton className="h-[52px] rounded-[14px]" />
          <Skeleton className="h-[86px] rounded-[16px]" />
          <Skeleton className="h-[86px] rounded-[16px]" />
          <Skeleton className="h-[86px] rounded-[16px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[260px] rounded-[16px]" />
          <Skeleton className="h-[220px] rounded-[16px]" />
        </div>
      </div>
    </div>
  );
}

export function AppRouteSkeleton() {
  return (
    <div className="flex min-h-svh bg-[#f3f7fb]">
      <Sidebar />
      <main className="flex-1 overflow-hidden px-[clamp(1.25rem,2.3vw,2.2rem)] py-[clamp(0.875rem,1.6vw,1.5rem)]">
        <GenericPageSkeleton />
      </main>
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <Skeleton className="mx-auto mb-6 h-9 w-56 rounded-[10px]" />
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="mx-auto h-5 w-44 rounded-full" />
      </div>
    </div>
  );
}

export function PatientsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[#cfe6f3] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-3 shadow-[0px_10px_28px_-20px_rgba(15,52,96,0.22)]">
      <div className="min-w-[52rem] rounded-[0.875rem] bg-[#f0f8ff] px-4 py-3">
        <div className="grid grid-cols-[minmax(11rem,1.8fr)_minmax(6rem,1fr)_minmax(10rem,1.6fr)_minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(7rem,1.1fr)] gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex min-w-[52rem] flex-col gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(11rem,1.8fr)_minmax(6rem,1fr)_minmax(10rem,1.6fr)_minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(7rem,1.1fr)] items-center gap-3 rounded-[0.9375rem] border border-[#e3eff8] bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-36 rounded-full" />
                <Skeleton className="h-2.5 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-40 rounded-full" />
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <div className="flex justify-end gap-2">
              <Skeleton className="size-9 rounded-[0.5625rem]" />
              <Skeleton className="size-9 rounded-[0.5625rem]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MedicationCatalogSkeleton() {
  return (
    <div className="ml-[67px] mt-[30px] grid w-[1086px] max-w-[calc(100%-67px)] grid-cols-1 gap-x-[16px] gap-y-[14px] xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[164px] rounded-[14px] border border-[#C2E0EF] bg-white p-4 shadow-[0px_4px_20px_rgba(194,224,239,0.2)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
            <Skeleton className="size-9 rounded-[10px]" />
          </div>
          <div className="mt-6 space-y-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgendaTimelineSkeleton() {
  return (
    <section className="flex min-w-0 flex-col gap-7">
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          key={index}
          className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-start gap-2.5"
        >
          <div className="space-y-2">
            <Skeleton className="h-8 w-12 rounded-[10px]" />
            <Skeleton className="h-3 w-10 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-[136px] rounded-[16px]" />
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export function UpcomingAppointmentsSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[16px] border border-[rgba(194,224,239,0.65)] bg-white p-3.5"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-[rgba(194,224,239,0.5)] pt-2.5">
            <Skeleton className="h-3.5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
