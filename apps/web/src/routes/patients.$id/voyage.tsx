import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

type VoyageRow = {
  id: string;
  patient_id: string;
  destination: string;
  date: string;
  duree_jours: number | null;
  epidemies_destination: string | null;
};

type PopupEventDetail = {
  type: "voyage";
  mode?: "create" | "edit" | "delete";
  voyageId?: string;
  initialValues?: {
    destination?: string;
    date?: string;
    duree_jours?: number | null;
    epidemies_destination?: string | null;
  };
};

export const Route = createFileRoute("/patients/$id/voyage")({
  component: RouteComponent,
  pendingComponent: VoyageSkeleton,
  pendingMs: 0,
});

function RouteComponent() {
  const { id } = Route.useParams();

  const { data } = useSuspenseQuery(
    trpc.travel.getPatientVoyages.queryOptions({ patient_id: id }),
  );

  const voyages = data as VoyageRow[];

  const openPopup = (detail: PopupEventDetail) => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail,
      }),
    );
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-[8px]">
            <MapPin className="size-5 shrink-0 text-[#052ca0]" />
            <h2 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-7 text-[#052ca0]">
              Voyages Récents
            </h2>
          </div>

          <button
            className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-5 py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] sm:w-[220px]"
            onClick={() =>
              openPopup({
                type: "voyage",
                mode: "create",
              })
            }
            type="button"
          >
            <Plus className="size-5 shrink-0" />
            <span className="truncate">Ajouter</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {voyages.length === 0 ? (
            <EmptyState text="Aucun voyage enregistré" />
          ) : (
            voyages.map((voyage) => (
              <article
                key={voyage.id}
                className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f9fafb] px-[16.8px] py-[16.8px]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-[#0f3460]" />
                        <h3 className="truncate font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-5 text-[#0f3460]">
                          {voyage.destination}
                        </h3>

                        <div className="flex shrink-0 items-center gap-1 text-[rgba(100,116,139,0.9)]">
                          <CalendarDays className="size-3.5 shrink-0" />
                          <span className="font-['Poppins'] text-[14px] leading-5">
                            {voyage.date}
                          </span>
                        </div>
                      </div>

                      <span
                        className="shrink-0 rounded-[8px] border border-[#0f3460] bg-[#c2e0ef] px-[8px] py-[2px] font-['Inter'] text-[12px] font-medium leading-4 text-[#0f3460]"
                      >
                        {typeof voyage.duree_jours === "number"
                          ? `${voyage.duree_jours} jours`
                          : "Durée inconnue"}
                      </span>
                    </div>

                    <div className="rounded-[4px] border-[0.8px] border-[#f97316] bg-[#fff7ed] px-2 py-2">
                      <p className="font-['Plus_Jakarta_Sans'] text-[12px] leading-4 text-[#f97316]">
                        Épidémies dans la destination :{" "}
                        {voyage.epidemies_destination?.trim() || "Aucune"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 self-start sm:self-stretch sm:justify-between">
                    <button
                      className="inline-flex h-7 w-full cursor-pointer items-center justify-center gap-1 rounded-[8px] border border-[#0f3460] bg-white px-2.5 font-['Plus_Jakarta_Sans'] text-[11px] leading-4 text-[#0f3460] transition-colors hover:bg-[#f8fafc]"
                      onClick={() =>
                        openPopup({
                          type: "voyage",
                          mode: "edit",
                          voyageId: voyage.id,
                          initialValues: {
                            destination: voyage.destination,
                            date: voyage.date,
                            duree_jours: voyage.duree_jours,
                            epidemies_destination: voyage.epidemies_destination,
                          },
                        })
                      }
                      type="button"
                    >
                      <Pencil className="size-3.5" />
                      <span>Modifier</span>
                    </button>

                    <button
                      aria-label="Supprimer le voyage"
                      className="inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-[8px] border border-[#e7000b] bg-white text-[#e7000b] transition-colors hover:bg-[#fef2f2]"
                      onClick={() =>
                        openPopup({
                          type: "voyage",
                          mode: "delete",
                          voyageId: voyage.id,
                          initialValues: {
                            destination: voyage.destination,
                            date: voyage.date,
                            duree_jours: voyage.duree_jours,
                            epidemies_destination: voyage.epidemies_destination,
                          },
                        })
                      }
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb] px-4 text-center">
      <span className="font-['Inter'] text-[14px] leading-5 text-[#64748b]">
        {text}
      </span>
    </div>
  );
}

function VoyageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-7 w-56 rounded-[8px]" />
          <Skeleton className="h-[42px] w-full rounded-[14px] sm:w-[220px]" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-[132px] rounded-[10px]" />
          <Skeleton className="h-[132px] rounded-[10px]" />
          <Skeleton className="h-[132px] rounded-[10px]" />
        </div>
      </section>
    </div>
  );
}
