import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CircleSlash,
  History,
  Package,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
    trpc.treatment.getActivePatientTreatments.queryOptions({ patient_id: id }),
  );

  const { data: allTreatmentsData } = useSuspenseQuery(
    trpc.treatment.getPatientTreatments.queryOptions({ patient_id: id }),
  );

  const activeTreatments = activeTreatmentsData as unknown as TreatmentRow[];
  const allTreatments = allTreatmentsData as unknown as TreatmentRow[];

  const inactiveTreatments = useMemo(
    () => allTreatments.filter((t) => !t.est_actif),
    [allTreatments],
  );

  const uniqueMedicationIds = useMemo(() => {
    return [...new Set(allTreatments.map((t) => t.medicament_externe_id))];
  }, [allTreatments]);

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

  const invalidateTreatmentQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.treatment.getActivePatientTreatments.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.treatment.getPatientTreatments.queryFilter({ patient_id: id }),
      ),
      queryClient.invalidateQueries(
        trpc.patient.getPatientFullRecord.queryFilter({ id }),
      ),
    ]);
  };

  const stopMutation = useMutation({
    mutationFn: async (treatmentId: string) => {
      return trpcClient.treatment.stopTreatment.mutate({ treatment_id: treatmentId });
    },
    onSuccess: async () => {
      await invalidateTreatmentQueries();
      toast.success("Traitement desactive");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (treatmentId: string) => {
      return trpcClient.treatment.deleteTreatment.mutate({ treatment_id: treatmentId });
    },
    onSuccess: async () => {
      await invalidateTreatmentQueries();
      toast.success("Traitement supprime");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (treatmentId: string) => {
      return trpcClient.treatment.updateTreatment.mutate({
        treatment_id: treatmentId,
        donnees: { est_actif: true },
      });
    },
    onSuccess: async () => {
      await invalidateTreatmentQueries();
      toast.success("Traitement reactive");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openPopup = (detail: PopupEventDetail) => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail,
      }),
    );
  };

  const openEditDialog = (treatment: TreatmentRow) => {
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

  const handleDeleteTreatment = (treatment: TreatmentRow) => {
    const confirmed = window.confirm(
      `Supprimer definitivement le traitement "${treatment.nom_medicament}" ?`,
    );
    if (!confirmed) return;

    deleteMutation.mutate(treatment.id);
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-[8px]">
            <Package className="size-5 shrink-0 text-[#052ca0]" />
            <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
              Traitements Actifs
            </h2>
          </div>

          <button
            className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-5 py-3 font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] sm:w-[288px]"
            onClick={() => openPopup({ type: "traitement", mode: "create" })}
            type="button"
          >
            <Plus className="size-5 shrink-0" />
            <span className="truncate">Ajouter un traitement</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {activeTreatments.length === 0 ? (
            <EmptyState text="Aucun traitement actif" />
          ) : (
            activeTreatments.map((treatment) => {
              const details = detailsMap.get(treatment.medicament_externe_id);
              const indication = details?.indications[0]?.indication ?? "-";
              const effet = details?.effets_indesirables[0]?.effet;
              const contreIndication = details?.contre_indications[0]?.description;
              const isOrdonnance = treatment.source_type === "ordonnance";

              return (
                <TreatmentCard
                  key={treatment.id}
                  contreIndication={contreIndication}
                  effet={effet}
                  indication={indication}
                  isDeleting={
                    deleteMutation.isPending &&
                    deleteMutation.variables === treatment.id
                  }
                  isOrdonnance={isOrdonnance}
                  isStopping={
                    stopMutation.isPending &&
                    stopMutation.variables === treatment.id
                  }
                  onDelete={() => {
                    handleDeleteTreatment(treatment);
                  }}
                  onEdit={() => {
                    openEditDialog(treatment);
                  }}
                  onStop={() => {
                    stopMutation.mutate(treatment.id);
                  }}
                  treatment={treatment}
                />
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex items-center gap-[8px] sm:mb-8">
          <History className="size-5 shrink-0 text-[#052ca0]" />
          <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
            Historique des Traitements
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {inactiveTreatments.length === 0 ? (
            <EmptyState text="Aucun traitement dans l'historique" />
          ) : (
            inactiveTreatments.map((treatment) => {
              const details = detailsMap.get(treatment.medicament_externe_id);
              const isOrdonnance = treatment.source_type === "ordonnance";
              const isReactivating =
                reactivateMutation.isPending &&
                reactivateMutation.variables === treatment.id;
              const isDeleting =
                deleteMutation.isPending && deleteMutation.variables === treatment.id;
              return (
                <div
                  key={treatment.id}
                  className="flex flex-col gap-3 rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-[#f9fafb] px-[12.8px] py-[12.8px] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-['Inter'] text-[14px] font-medium leading-5 text-[#0f3460]">
                        {treatment.nom_medicament}
                      </h3>
                      {isOrdonnance ? (
                        <span className="inline-flex items-center gap-1 rounded-[8px] border-[0.8px] border-[#c2e0ef] bg-white px-2 py-[2px] font-['Poppins'] text-[12px] leading-4 text-[#265284]">
                          Ordonnance
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 font-['Inter'] text-[12px] leading-4 text-[#4b6787]">
                      {details?.indications[0]?.indication ?? "-"}
                    </p>
                    <p className="mt-1 font-['Inter'] text-[12px] leading-4 text-[#64748b]">
                      Prescrit le : {formatTreatmentDate(treatment.date_prescription)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="flex items-center gap-1 rounded-[8px] border-[0.8px] border-[#d1d5dc] bg-[#f3f4f6] px-2 py-[2px] text-[#6a7282]">
                      <CircleSlash className="size-3" />
                      <span className="font-['Poppins'] text-[12px] leading-4">
                        Inactif
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HistoryActionButton
                        ariaLabel="Modifier le traitement"
                        disabled={isDeleting || isReactivating}
                        onClick={() => {
                          openEditDialog(treatment);
                        }}
                        title="Modifier"
                        tone="orange"
                      >
                        <Pencil className="size-4 text-[#f77a21]" />
                      </HistoryActionButton>
                      <HistoryActionButton
                        ariaLabel="Reactiver le traitement"
                        disabled={isDeleting || isReactivating}
                        onClick={() => {
                          reactivateMutation.mutate(treatment.id);
                        }}
                        title="Reactiver"
                      >
                        <RotateCcw className="size-4 text-[#0f3460]" />
                      </HistoryActionButton>
                      <HistoryActionButton
                        ariaLabel="Supprimer le traitement"
                        disabled={isDeleting || isReactivating}
                        onClick={() => handleDeleteTreatment(treatment)}
                        title="Supprimer"
                        tone="orange"
                      >
                        <Trash2 className="size-4 text-[#f77a21]" />
                      </HistoryActionButton>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function TreatmentCard({
  treatment,
  indication,
  effet,
  contreIndication,
  isOrdonnance,
  isStopping,
  isDeleting,
  onDelete,
  onEdit,
  onStop,
}: {
  treatment: TreatmentRow;
  indication: string;
  effet?: string;
  contreIndication?: string;
  isOrdonnance: boolean;
  isStopping: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onStop: () => void;
}) {
  return (
    <article className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-['Inter'] text-[16px] font-medium leading-6 text-[#0f3460]">
              {treatment.nom_medicament}
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-[8px] border-[0.8px] px-2 py-[2px] font-['Poppins'] text-[12px] leading-4",
                treatment.source_type === "ordonnance"
                  ? "border-[#c2e0ef] bg-white text-[#265284]"
                  : "border-[#7bf1a8] bg-[#f0fdf4] text-[#008236]",
              )}
            >
              <CheckCircle2 className="size-3" />
              {treatment.source_type === "ordonnance" ? "Ordonnance" : "Actif"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 font-['Inter'] text-[14px] leading-5 text-[#265284]">
            {indication}
          </p>
        </div>

        <div className="ml-auto grid shrink-0 grid-cols-[93px_105px_35px] items-center gap-2">
          <button
            className="flex h-[35px] w-[93px] cursor-pointer items-center justify-center gap-[3px] rounded-[10px] border border-[#c2e0ef] bg-white px-3 font-['Poppins'] text-[12px] leading-4 text-[#f97316] transition-colors hover:bg-[#fff7ed]"
            onClick={onEdit}
            title="Modifier"
            type="button"
          >
            <Pencil className="size-4 shrink-0" />
            <span>Modifier</span>
          </button>

          <button
            className="flex h-[36px] w-[105px] cursor-pointer items-center justify-center gap-1 rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[12px] font-medium leading-4 text-[#265284] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStopping}
            onClick={onStop}
            title="Desactiver"
            type="button"
          >
            <Power className="size-4 shrink-0" />
            <span>{isStopping ? "..." : "Desactiver"}</span>
          </button>

          <button
            aria-label="Supprimer le traitement"
            className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
            onClick={onDelete}
            title="Supprimer"
            type="button"
          >
            <Trash2 className="size-4 text-[#265284]" />
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <TreatmentInfo label="Posologie" value={treatment.posologie} />
        <TreatmentInfo label="Dosage" value={treatment.dosage ?? "-"} />
      </div>

      <div className="space-y-2">
        {effet ? (
          <WarningBlock label="Effets indesirables" tone="orange" value={effet} />
        ) : null}

        {contreIndication ? (
          <WarningBlock
            label="Contre-indications"
            tone="red"
            value={contreIndication}
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1 text-[rgba(100,116,139,0.9)]">
        <Calendar className="size-3 shrink-0" />
        <p className="font-['Inter'] text-[12px] leading-4">
          Prescrit le : {formatTreatmentDate(treatment.date_prescription)}
        </p>
      </div>
    </article>
  );
}

function HistoryActionButton({
  ariaLabel,
  children,
  disabled,
  onClick,
  title,
  tone = "default",
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  tone?: "default" | "orange";
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        tone === "orange"
          ? "border-[#f77a21] hover:bg-[#fff7ed]"
          : "border-[#c2e0ef] hover:bg-[#f8fafc]",
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function TreatmentInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[8px] bg-white/70 px-3 py-2">
      <p className="font-['Inter'] text-[13px] leading-5 text-[rgba(100,116,139,0.9)]">
        {label} :
      </p>
      <p className="break-words font-['Inter'] text-[14px] leading-5 text-[#0f3460]">
        {value}
      </p>
    </div>
  );
}

function WarningBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "orange" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-[4px] border-[0.8px] px-[8.8px] py-[8.8px]",
        tone === "orange"
          ? "border-[#f97316] bg-[#fff7ed]"
          : "border-[#e7000b] bg-[#fef2f2]",
      )}
    >
      <div className="flex gap-2">
        <AlertCircle
          className={cn(
            "mt-[2px] size-4 shrink-0",
            tone === "orange" ? "text-[#f97316]" : "text-[#e7000b]",
          )}
        />
        <div className="min-w-0">
          <p className="font-['Inter'] text-[12px] leading-4 text-[rgba(100,116,139,0.9)]">
            {label} :
          </p>
          <p
            className={cn(
              "break-words font-['Inter'] text-[14px] leading-5",
              tone === "orange" ? "text-[#f97316]" : "text-[#e7000b]",
            )}
          >
            {value}
          </p>
        </div>
      </div>
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

function TraitementSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 pb-4">
      <Skeleton className="h-[420px] rounded-[14px]" />
      <Skeleton className="h-[220px] rounded-[14px]" />
    </div>
  );
}

function formatTreatmentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
