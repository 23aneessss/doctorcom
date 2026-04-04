import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Package,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type TreatmentRow = {
  id: string;
  medicament_externe_id: string;
  nom_medicament: string;
  dosage: string | null;
  posologie: string;
  date_prescription: string;
  est_actif: boolean;
  source_type: "manuel" | "ordonnance";
};

type PopupEventDetail = {
  type: "traitement";
  mode?: "create" | "edit";
  traitementId?: string;
  initialValues?: Record<string, string | boolean | undefined | null>;
};

export const Route = createFileRoute("/patients/$id/traitement")({
  component: RouteComponent,
  pendingComponent: TraitementSkeleton,
  pendingMs: 0,
});

function RouteComponent() {
  const { id } = Route.useParams();

  const { data: activeTreatmentsData } = useSuspenseQuery(
    trpc.treatment.getActivePatientTreatments.queryOptions({ patient_id: id })
  );

  const { data: allTreatmentsData } = useSuspenseQuery(
    trpc.treatment.getPatientTreatments.queryOptions({ patient_id: id })
  );

  const activeTreatments = activeTreatmentsData as unknown as TreatmentRow[];
  const allTreatments = allTreatmentsData as unknown as TreatmentRow[];

  const inactiveTreatments = useMemo(
    () => allTreatments.filter((t) => !t.est_actif),
    [allTreatments]
  );

  const uniqueMedicationIds = useMemo(() => {
    return [...new Set(activeTreatments.map((t) => t.medicament_externe_id))];
  }, [activeTreatments]);

  const medicationDetailsQueries = useQueries({
    queries: uniqueMedicationIds.map((externalId) => {
      const parsed = Number.parseInt(externalId, 10);
      return {
        ...trpc.medicaments.getMedicamentById.queryOptions({ id: parsed || 0 }),
        enabled: Number.isInteger(parsed) && parsed > 0,
      };
    }),
  });

  const detailsMap = useMemo(() => {
    const map = new Map<string, any>();
    uniqueMedicationIds.forEach((externalId, index) => {
      const data = medicationDetailsQueries[index]?.data;
      if (data) map.set(externalId, data);
    });
    return map;
  }, [uniqueMedicationIds, medicationDetailsQueries]);

  const stopMutation = useMutation({
    mutationFn: async (treatmentId: string) => {
      return trpcClient.treatment.stopTreatment.mutate({ treatment_id: treatmentId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(
          trpc.treatment.getActivePatientTreatments.queryFilter({ patient_id: id })
        ),
        queryClient.invalidateQueries(
          trpc.treatment.getPatientTreatments.queryFilter({ patient_id: id })
        ),
        queryClient.invalidateQueries(
          trpc.patient.getPatientFullRecord.queryFilter({ id })
        ),
      ]);
      toast.success("Traitement désactivé");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openPopup = (detail: PopupEventDetail) => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail,
      })
    );
  };

  const openEditDialog = (treatment: TreatmentRow) => {
    if (treatment.source_type === "ordonnance") {
      toast.info("Les traitements d'ordonnance se gèrent depuis le module ordonnance");
      return;
    }

    const details = detailsMap.get(treatment.medicament_externe_id);
    openPopup({
      type: "traitement",
      mode: "edit",
      traitementId: treatment.id,
      initialValues: {
        medicament_externe_id: treatment.medicament_externe_id,
        nom_medicament: treatment.nom_medicament,
        indication: details?.indications[0]?.indication ?? "",
        dosage: treatment.dosage ?? "",
        posologie: treatment.posologie,
        contre_indications: details?.contre_indications[0]?.description ?? "",
        effets_indesirables: details?.effets_indesirables[0]?.effet ?? "",
        date_prescription: String(treatment.date_prescription).slice(0, 10),
        est_actif: treatment.est_actif,
      },
    });
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-[24.8px] pb-[0.8px] pt-[24.8px] shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)]">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-[5px]">
            <Package className="size-5 text-[#052ca0]" />
            <h2 className="font-['Inter'] text-[20px] font-medium text-[#052ca0]">
              Traitements Actifs
            </h2>
          </div>

          <button
            className="flex h-[42px] w-[288px] items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-[66px] py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)]"
            onClick={() => openPopup({ type: "traitement", mode: "create" })}
            type="button"
          >
            <Plus className="size-5" />
            Ajouter un traitement
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {activeTreatments.length === 0 ? (
            <EmptyState text="Aucun traitement actif" />
          ) : (
            activeTreatments.map((treatment) => {
              const details = detailsMap.get(treatment.medicament_externe_id);
              const indication = details?.indications[0]?.indication ?? "—";
              const effet = details?.effets_indesirables[0]?.effet;
              const contreIndication = details?.contre_indications[0]?.description;
              const isOrdonnance = treatment.source_type === "ordonnance";

              return (
                <article
                  key={treatment.id}
                  className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="font-['Inter'] text-[16px] font-medium text-[#0f3460]">
                        {treatment.nom_medicament}
                      </h3>
                      <p className="font-['Inter'] text-[14px] text-[#265284]">{indication}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="flex h-[35px] w-[93px] items-center justify-center gap-[3px] rounded-[10px] border border-[#c2e0ef] bg-white font-['Poppins'] text-[12px] text-[#f97316]"
                        disabled={isOrdonnance}
                        onClick={() => openEditDialog(treatment)}
                        type="button"
                      >
                        <Pencil className="size-4" />
                        Modifier
                      </button>

                      <button
                        className="flex h-[36px] w-[96px] items-center justify-center gap-1 rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white font-['Inter'] text-[12px] font-medium text-[#265284]"
                        disabled={isOrdonnance || stopMutation.isPending}
                        onClick={() => stopMutation.mutate(treatment.id)}
                        type="button"
                      >
                        <Power className="size-4" />
                        désactiver
                      </button>

                      <button
                        className="flex size-[35.2px] items-center justify-center rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white"
                        disabled
                        type="button"
                      >
                        <Trash2 className="size-4 text-[#265284]" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)]">Posologie :</p>
                      <p className="font-['Inter'] text-[14px] text-[#0f3460]">{treatment.posologie}</p>
                    </div>
                    <div>
                      <p className="font-['Inter'] text-[14px] text-[rgba(100,116,139,0.9)]">Dosage :</p>
                      <p className="font-['Inter'] text-[14px] text-[#0f3460]">
                        {treatment.dosage ?? "—"}
                      </p>
                    </div>
                  </div>

                  {effet ? (
                    <div className="mb-2 rounded-[4px] border-[0.8px] border-[#f97316] bg-[#fff7ed] px-[8.8px] pb-[0.8px] pt-[8.8px]">
                      <div className="flex gap-2">
                        <AlertCircle className="mt-[2px] size-4 text-[#f97316]" />
                        <div>
                          <p className="font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                            Effets indésirables :
                          </p>
                          <p className="font-['Inter'] text-[14px] text-[#f97316]">{effet}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {contreIndication ? (
                    <div className="mb-3 rounded-[4px] border-[0.8px] border-[#e7000b] bg-[#fef2f2] px-[8.8px] pb-[0.8px] pt-[8.8px]">
                      <div className="flex gap-2">
                        <AlertCircle className="mt-[2px] size-4 text-[#e7000b]" />
                        <div>
                          <p className="font-['Inter'] text-[12px] text-[rgba(100,116,139,0.9)]">
                            Contre-indications :
                          </p>
                          <p className="font-['Inter'] text-[14px] text-[#e7000b]">
                            {contreIndication}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-1 text-[rgba(100,116,139,0.9)]">
                    <Calendar className="size-3" />
                    <p className="font-['Inter'] text-[12px]">
                      Prescrit le : {String(treatment.date_prescription).slice(0, 10)}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-[24.8px] pb-[0.8px] pt-[24.8px] shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)]">
        <div className="mb-10 flex items-center gap-[5px]">
          <Package className="size-5 text-[#052ca0]" />
          <h2 className="font-['Inter'] text-[20px] font-medium text-[#052ca0]">
            Historique des Traitements
          </h2>
        </div>

        <div className="flex flex-col gap-3 pb-4">
          {inactiveTreatments.length === 0 ? (
            <EmptyState text="Aucun traitement dans l'historique" />
          ) : (
            inactiveTreatments.map((t) => {
              const details = detailsMap.get(t.medicament_externe_id);
              return (
                <div
                  key={t.id}
                  className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f9fafb] px-[12.8px] pb-[0.8px] pt-[12.8px]"
                >
                  <h3 className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">
                    {t.nom_medicament}
                  </h3>
                  <p className="font-['Inter'] text-[12px] text-[#4b6787]">
                    {details?.indications[0]?.indication ?? "—"}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
      <span className="font-['Inter'] text-[14px] text-[#64748b]">{text}</span>
    </div>
  );
}

function TraitementSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <Skeleton className="h-[420px] rounded-[14px]" />
      <Skeleton className="h-[220px] rounded-[14px]" />
    </div>
  );
}
