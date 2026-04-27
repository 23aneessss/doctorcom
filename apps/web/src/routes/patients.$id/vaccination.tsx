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
            <Syringe className="size-5 shrink-0 text-[#052ca0]" />
            <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
              Historique des vaccinations
            </h2>
          </div>

          <button
            className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-5 py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] sm:w-[288px]"
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

        <div className="flex flex-col gap-3">
          {vaccinations.length === 0 ? (
            <EmptyState text="Aucune vaccination enregistrée" />
          ) : (
            vaccinations.map((vaccination) => (
              <article
                key={vaccination.id}
                className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#c2e0ef] px-[12.8px] py-[12.8px]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate font-['Inter'] text-[14px] font-medium leading-5 text-[#0f3460]">
                      {vaccination.vaccin}
                    </h3>
                    <div className="mt-1 flex items-center gap-1 text-[rgba(100,116,139,0.9)]">
                      <CalendarDays className="size-3 shrink-0" />
                      <span className="font-['Inter'] text-[12px] leading-4">
                        {vaccination.date_vaccination}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[10px] border border-[#0f3460] bg-white px-3 font-['Plus_Jakarta_Sans'] text-[12px] leading-4 text-[#0f3460] transition-colors hover:bg-[#f8fafc]"
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
                      <Pencil className="size-3.5" />
                      <span>Modifier</span>
                    </button>

                    <button
                      aria-label="Supprimer la vaccination"
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[10px] border border-[#e7000b] bg-white text-[#e7000b] transition-colors hover:bg-[#fef2f2]"
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
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2">
                  <FileText className="mt-[1px] size-[14px] shrink-0 text-[#64748b]" />
                  <p className="line-clamp-2 font-['Inter'] text-[14px] leading-5 text-[#64748b]">
                    {vaccination.notes?.trim() || "Sans notes"}
                  </p>
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

function VaccinationSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-64 rounded-[8px]" />
          <Skeleton className="h-[42px] w-[288px] rounded-[14px]" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-[92px] rounded-[10px]" />
          <Skeleton className="h-[92px] rounded-[10px]" />
          <Skeleton className="h-[92px] rounded-[10px]" />
        </div>
      </section>
    </div>
  );
}
