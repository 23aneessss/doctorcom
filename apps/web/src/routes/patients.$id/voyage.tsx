import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";

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
  const latestVoyage = voyages[0];

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
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-[8px]">
            <MapPin className="size-5 shrink-0 text-[#052ca0]" />
            <div className="min-w-0">
              <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
                Voyages récents
              </h2>
              <p className="font-['Inter'] text-[13px] leading-5 text-[#6b819d]">
                {latestVoyage
                  ? `Dernier déplacement : ${latestVoyage.destination}`
                  : "Aucun voyage enregistré pour ce patient."}
              </p>
            </div>
          </div>

          <button
            className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-5 py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] sm:w-[288px]"
            onClick={() =>
              openPopup({
                type: "voyage",
                mode: "create",
              })
            }
            type="button"
          >
            <Plus className="size-5 shrink-0" />
            <span className="truncate">Ajouter un voyage</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {voyages.length === 0 ? (
            <EmptyState text="Aucun voyage enregistré" />
          ) : (
            voyages.map((voyage) => (
              <article
                key={voyage.id}
                className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4"
              >
                <div className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-['Inter'] text-[14px] font-medium leading-5 text-[#0f3460]">
                        {voyage.destination}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#c2e0ef] bg-white px-2.5 font-['Inter'] text-[12px] font-semibold text-[#6b819d]">
                          <CalendarDays className="size-3" />
                          {voyage.date}
                        </span>
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#c2e0ef] bg-white px-2.5 font-['Inter'] text-[12px] font-semibold text-[#6b819d]">
                          <Clock3 className="size-3" />
                          {typeof voyage.duree_jours === "number"
                            ? `${voyage.duree_jours} jours`
                            : "Durée inconnue"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        aria-label="Modifier le voyage"
                        className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white text-[#0f3460] transition-colors hover:bg-[#f8fafc]"
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
                        <Pencil className="size-4" />
                      </button>

                      <button
                        aria-label="Supprimer le voyage"
                        className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#fecaca] bg-white text-[#e7000b] transition-colors hover:bg-[#fef2f2]"
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
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto rounded-[8px] border-[0.8px] border-[#ffe0c2] bg-[#fffaf5] px-3 py-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 size-[13px] shrink-0 text-[#f97316]" />
                      <p className="font-['Inter'] text-[12px] leading-5 text-[#8a5a32]">
                        <span className="font-semibold text-[#f97316]">
                          Risque local :
                        </span>{" "}
                        {voyage.epidemies_destination?.trim() ||
                          "Aucune épidémie renseignée"}
                      </p>
                    </div>
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
    <div className="col-span-full flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb] px-4 text-center">
      <span className="font-['Inter'] text-[14px] leading-5 text-[#64748b]">
        {text}
      </span>
    </div>
  );
}

function VoyageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <Skeleton className="h-[420px] rounded-[14px]" />
    </div>
  );
}
