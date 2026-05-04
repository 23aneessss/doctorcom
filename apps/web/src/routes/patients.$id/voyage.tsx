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
      <section className="overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-white shadow-[0px_10px_30px_-22px_rgba(15,52,96,0.45)]">
        <div className="flex flex-col gap-4 border-b border-[#e2f2fa] bg-gradient-to-r from-[#f8fcff] via-white to-[#eef8fd] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-[#eef8fd] text-[#052ca0] ring-1 ring-[#c2e0ef]">
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-['Plus_Jakarta_Sans'] text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7a93af]">
                Expositions
              </p>
              <h2 className="mt-1 font-['Plus_Jakarta_Sans'] text-[24px] font-semibold leading-8 text-[#0f3460]">
                Voyages récents
              </h2>
              <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#6b819d]">
                {latestVoyage
                  ? `Dernier déplacement : ${latestVoyage.destination}`
                  : "Aucun voyage enregistré pour ce patient."}
              </p>
            </div>
          </div>

          <button
            className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[15px] bg-[#052ca0] px-6 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white shadow-[0px_14px_28px_-18px_rgba(5,44,160,0.75)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] sm:w-[240px]"
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

        <div className="grid grid-cols-1 gap-3 px-5 py-5 sm:px-6 lg:grid-cols-2">
          {voyages.length === 0 ? (
            <EmptyState text="Aucun voyage enregistré" />
          ) : (
            voyages.map((voyage) => (
              <article
                key={voyage.id}
                className="group rounded-[16px] border border-[#c2e0ef] bg-white p-4 shadow-[0px_8px_22px_-20px_rgba(15,52,96,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#76bbdd] hover:shadow-[0px_16px_32px_-24px_rgba(15,52,96,0.45)]"
              >
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e2f4fb] text-[#265284]">
                        <MapPin className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-6 text-[#0f3460]">
                          {voyage.destination}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#c2e0ef] bg-[#f8fcff] px-3 font-['Inter'] text-[13px] font-semibold text-[#6b819d]">
                            <CalendarDays className="size-3.5" />
                            {voyage.date}
                          </span>
                          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#c2e0ef] bg-[#f8fcff] px-3 font-['Inter'] text-[13px] font-semibold text-[#6b819d]">
                            <Clock3 className="size-3.5" />
                            {typeof voyage.duree_jours === "number"
                              ? `${voyage.duree_jours} jours`
                              : "Durée inconnue"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        aria-label="Modifier le voyage"
                        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[12px] border border-[#c2e0ef] bg-white text-[#0f3460] transition-colors hover:bg-[#f8fcff]"
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
                        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[12px] border border-[#fecaca] bg-white text-[#e7000b] transition-colors hover:bg-[#fef2f2]"
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

                  <div className="mt-auto rounded-[12px] border border-[#ffe0c2] bg-[#fffaf5] px-3 py-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#f97316]" />
                      <p className="font-['Inter'] text-[13px] leading-5 text-[#8a5a32]">
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
    <div className="col-span-full flex h-[190px] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#c2e0ef] bg-[#f8fcff] px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-white text-[#76bbdd] ring-1 ring-[#c2e0ef]">
        <MapPin className="size-5" />
      </span>
      <span className="mt-3 font-['Plus_Jakarta_Sans'] text-[15px] font-semibold leading-5 text-[#0f3460]">
        {text}
      </span>
      <span className="mt-1 max-w-[320px] font-['Inter'] text-[13px] leading-5 text-[#7a93af]">
        Ajoutez les déplacements importants pour contextualiser les risques
        d'exposition.
      </span>
    </div>
  );
}

function VoyageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <section className="overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-white shadow-[0px_10px_30px_-22px_rgba(15,52,96,0.45)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e2f2fa] px-6 py-5">
          <Skeleton className="h-16 w-80 rounded-[16px]" />
          <Skeleton className="h-[52px] w-[240px] rounded-[15px]" />
        </div>

        <div className="grid grid-cols-1 gap-3 px-6 py-5 lg:grid-cols-2">
          <Skeleton className="h-[150px] rounded-[16px]" />
          <Skeleton className="h-[150px] rounded-[16px]" />
          <Skeleton className="h-[150px] rounded-[16px]" />
        </div>
      </section>
    </div>
  );
}
