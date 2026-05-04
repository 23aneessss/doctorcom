import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  FileText,
  Pencil,
  Plus,
  Syringe,
  Trash2,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

type VaccinationRow = {
  id: string;
  patient_id: string;
  vaccin: string;
  date_vaccination: string;
  notes: string | null;
};

type PopupEventDetail = {
  type: "vaccination";
  mode?: "create" | "edit" | "delete";
  vaccinationId?: string;
  initialValues?: {
    vaccin?: string;
    date_vaccination?: string;
    notes?: string | null;
  };
};

export const Route = createFileRoute("/patients/$id/vaccination")({
  component: RouteComponent,
  pendingComponent: VaccinationSkeleton,
  pendingMs: 0,
});

function RouteComponent() {
  const { id } = Route.useParams();

  const { data } = useSuspenseQuery(
    trpc.vaccination.getPatientVaccinations.queryOptions({ patient_id: id }),
  );

  const vaccinations = data as VaccinationRow[];
  const latestVaccination = vaccinations[0];

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
              <Syringe className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-['Plus_Jakarta_Sans'] text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7a93af]">
                Prévention
              </p>
              <h2 className="mt-1 font-['Plus_Jakarta_Sans'] text-[24px] font-semibold leading-8 text-[#0f3460]">
                Historique des vaccinations
              </h2>
              <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#6b819d]">
                {latestVaccination
                  ? `Dernier vaccin : ${latestVaccination.vaccin}`
                  : "Aucune vaccination enregistrée pour ce patient."}
              </p>
            </div>
          </div>

          <button
            className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[15px] bg-[#052ca0] px-6 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white shadow-[0px_14px_28px_-18px_rgba(5,44,160,0.75)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] sm:w-[300px]"
            onClick={() =>
              openPopup({
                type: "vaccination",
                mode: "create",
              })
            }
            type="button"
          >
            <Plus className="size-5 shrink-0" />
            <span className="truncate">Ajouter une vaccination</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-5 sm:px-6">
          {vaccinations.length === 0 ? (
            <EmptyState text="Aucune vaccination enregistrée" />
          ) : (
            vaccinations.map((vaccination) => (
              <article
                key={vaccination.id}
                className="group rounded-[16px] border border-[#c2e0ef] bg-white px-4 py-4 shadow-[0px_8px_22px_-20px_rgba(15,52,96,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#76bbdd] hover:shadow-[0px_16px_32px_-24px_rgba(15,52,96,0.45)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e2f4fb] text-[#265284]">
                      <Syringe className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-6 text-[#0f3460]">
                          {vaccination.vaccin}
                        </h3>
                        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#c2e0ef] bg-[#f8fcff] px-3 font-['Inter'] text-[13px] font-semibold text-[#6b819d]">
                          <CalendarDays className="size-3.5" />
                          {vaccination.date_vaccination}
                        </span>
                      </div>

                      <div className="mt-3 flex items-start gap-2">
                        <FileText className="mt-[2px] size-[15px] shrink-0 text-[#76bbdd]" />
                        <p className="line-clamp-2 font-['Inter'] text-[14px] leading-6 text-[#64748b]">
                          {vaccination.notes?.trim() || "Sans notes"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <button
                      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[12px] border border-[#c2e0ef] bg-white px-4 font-['Plus_Jakarta_Sans'] text-[13px] font-semibold leading-4 text-[#0f3460] transition-colors hover:bg-[#f8fcff]"
                      onClick={() =>
                        openPopup({
                          type: "vaccination",
                          mode: "edit",
                          vaccinationId: vaccination.id,
                          initialValues: {
                            vaccin: vaccination.vaccin,
                            date_vaccination: vaccination.date_vaccination,
                            notes: vaccination.notes,
                          },
                        })
                      }
                      type="button"
                    >
                      <Pencil className="size-4" />
                      <span>Modifier</span>
                    </button>

                    <button
                      aria-label="Supprimer la vaccination"
                      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[12px] border border-[#fecaca] bg-white text-[#e7000b] transition-colors hover:bg-[#fef2f2]"
                      onClick={() =>
                        openPopup({
                          type: "vaccination",
                          mode: "delete",
                          vaccinationId: vaccination.id,
                          initialValues: {
                            vaccin: vaccination.vaccin,
                            date_vaccination: vaccination.date_vaccination,
                            notes: vaccination.notes,
                          },
                        })
                      }
                      type="button"
                    >
                      <Trash2 className="size-4" />
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
    <div className="flex h-[190px] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#c2e0ef] bg-[#f8fcff] px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-white text-[#76bbdd] ring-1 ring-[#c2e0ef]">
        <Syringe className="size-5" />
      </span>
      <span className="mt-3 font-['Plus_Jakarta_Sans'] text-[15px] font-semibold leading-5 text-[#0f3460]">
        {text}
      </span>
      <span className="mt-1 max-w-[320px] font-['Inter'] text-[13px] leading-5 text-[#7a93af]">
        Ajoutez une vaccination pour compléter l'historique préventif du patient.
      </span>
    </div>
  );
}

function VaccinationSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <section className="overflow-hidden rounded-[18px] border border-[#c2e0ef] bg-white shadow-[0px_10px_30px_-22px_rgba(15,52,96,0.45)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e2f2fa] px-6 py-5">
          <Skeleton className="h-16 w-80 rounded-[16px]" />
          <Skeleton className="h-[52px] w-[300px] rounded-[15px]" />
        </div>

        <div className="flex flex-col gap-3 px-6 py-5">
          <Skeleton className="h-[98px] rounded-[16px]" />
          <Skeleton className="h-[98px] rounded-[16px]" />
          <Skeleton className="h-[98px] rounded-[16px]" />
        </div>
      </section>
    </div>
  );
}
