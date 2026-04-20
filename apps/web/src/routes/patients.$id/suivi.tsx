import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Pencil,
  Plus,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type PopupEventDetail = {
  type: "suivi" | "consultation";
  mode?: "create" | "edit";
  suiviId?: string;
  examenId?: string;
  initialValues?: Record<string, string | undefined>;
};

export const Route = createFileRoute("/patients/$id/suivi")({
  component: RouteComponent,
  pendingComponent: SuiviSkeleton,
  pendingMs: 0,
});

function RouteComponent() {
  const { id } = Route.useParams();

  const { data: suivis } = useSuspenseQuery(
    trpc.consultation.getPatientSuivis.queryOptions({ patient_id: id }),
  );
  const { data: examens } = useSuspenseQuery(
    trpc.consultation.getExamensPatient.queryOptions({ patient_id: id }),
  );

  const [selectedSuiviId, setSelectedSuiviId] = useState<string | null>(
    suivis[0]?.id ?? null,
  );
  const [expandedExamenId, setExpandedExamenId] = useState<string | null>(null);

  const examensBySuivi = useMemo(() => {
    const grouped = new Map<string, typeof examens>();
    for (const examen of examens) {
      const previous = grouped.get(examen.suivi_id) ?? [];
      grouped.set(examen.suivi_id, [...previous, examen]);
    }
    for (const [key, list] of grouped.entries()) {
      grouped.set(
        key,
        [...list].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      );
    }
    return grouped;
  }, [examens]);

  const selectedSuivi = useMemo(() => {
    if (!selectedSuiviId) return suivis[0] ?? null;
    return (
      suivis.find((suivi) => suivi.id === selectedSuiviId) ?? suivis[0] ?? null
    );
  }, [selectedSuiviId, suivis]);

  const selectedExamens = selectedSuivi
    ? (examensBySuivi.get(selectedSuivi.id) ?? [])
    : [];

  const closeSuiviMutation = useMutation({
    mutationFn: async (suiviId: string) => {
      return trpcClient.consultation.closeSuivi.mutate({ suivi_id: suiviId });
    },
    onSuccess: async () => {
      await invalidateSuiviQueries(id);
      toast.success("Suivi cloture");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reactivateSuiviMutation = useMutation({
    mutationFn: async (suiviId: string) => {
      return trpcClient.consultation.updateSuivi.mutate({
        suivi_id: suiviId,
        donnees: {
          est_actif: true,
          date_fermeture: null,
        },
      });
    },
    onSuccess: async () => {
      await invalidateSuiviQueries(id);
      toast.success("Suivi reactive");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isActionPending =
    closeSuiviMutation.isPending || reactivateSuiviMutation.isPending;

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const openPopup = (detail: PopupEventDetail) => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail,
      }),
    );
  };

  return (
    <div className="grid items-start gap-6 pb-6 xl:grid-cols-[288px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {suivis.slice(0, 3).map((suivi) => {
            const consultationsCount =
              examensBySuivi.get(suivi.id)?.length ?? 0;
            const isSelected = selectedSuivi?.id === suivi.id;

            return (
              <button
                key={suivi.id}
                className={cn(
                  "relative min-h-[112px] w-full cursor-pointer rounded-[14px] border-[0.8px] px-4 py-3 text-left transition-all duration-200 ease-out",
                  isSelected
                    ? "border-[#c2e0ef] bg-[#f0f6ff] shadow-[0px_3px_8px_0px_rgba(15,52,96,0.12)]"
                    : "border-[#c2e0ef] bg-white hover:bg-[#f8fcff]",
                )}
                onClick={() => {
                  setSelectedSuiviId(suivi.id);
                  setExpandedExamenId(null);
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold leading-[20px] text-[#0f3460]">
                    {suivi.motif}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-[8px] border-[0.8px] px-[6.8px] py-[2.8px] font-['Inter'] text-[10px] font-medium leading-[15px]",
                      suivi.est_actif
                        ? "border-[#7bf1a8] bg-[#f0fdf4] text-[#008236]"
                        : "border-[#d1d5dc] bg-[#f3f4f6] text-[#6a7282]",
                    )}
                  >
                    {suivi.est_actif ? "Actif" : "Cloture"}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 font-['Plus_Jakarta_Sans'] text-[12px] font-medium leading-[17px] text-[rgba(100,116,139,0.9)]">
                  {suivi.hypothese_diagnostic || "Hypothese non renseignee"}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1">
                    <Calendar className="size-3 shrink-0 text-[rgba(100,116,139,0.9)]" />
                    <span className="truncate font-['Plus_Jakarta_Sans'] text-[10px] font-medium leading-[15px] text-[rgba(100,116,139,0.9)]">
                      {suivi.date_ouverture}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1">
                    <ClipboardList className="size-3 shrink-0 text-[rgba(100,116,139,0.9)]" />
                    <span className="truncate font-['Plus_Jakarta_Sans'] text-[10px] font-medium leading-[15px] text-[rgba(100,116,139,0.9)]">
                      {consultationsCount} consultation
                      {consultationsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          className="flex h-[46px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-[14px] bg-[#052ca0] px-4 py-3 shadow-[0px_4px_12px_0px_rgba(5,44,160,0.35)] transition-transform duration-200 ease-out hover:-translate-y-0.5"
          onClick={() => openPopup({ type: "suivi", mode: "create" })}
          type="button"
        >
          <Plus className="size-5 text-white" />
          <span className="font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white">
            Nouveau suivi
          </span>
        </button>
      </aside>

      <section className="flex min-w-0 flex-col gap-5">
        <div className="min-h-[202px] w-full rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white">
          {selectedSuivi ? (
            <>
              <div className="flex items-start justify-between px-5 pt-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-['Plus_Jakarta_Sans'] text-[20px] font-medium leading-[30px] text-[#052ca0]">
                      {selectedSuivi.motif}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex h-[21.587px] items-center gap-[5px] rounded-[8px] border-[0.8px] pl-2 pr-[9px]",
                        selectedSuivi.est_actif
                          ? "border-[#7bf1a8] bg-[#f0fdf4] text-[#008236]"
                          : "border-[#d1d5dc] bg-[#f3f4f6] text-[#6a7282]",
                      )}
                    >
                      {selectedSuivi.est_actif ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <Circle className="size-3" />
                      )}
                      <span className="font-['Poppins'] text-[12px] font-medium leading-4">
                        {selectedSuivi.est_actif ? "Actif" : "Cloture"}
                      </span>
                    </span>
                  </div>
                  <p className="font-['Plus_Jakarta_Sans'] text-[14px] leading-5 text-[#f97316]">
                    Hypothese :{" "}
                    {selectedSuivi.hypothese_diagnostic || "Non renseignee"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex h-[29.587px] cursor-pointer items-center gap-1 rounded-[10px] border-[0.8px] border-[#0f3460] px-3"
                    onClick={() =>
                      openPopup({
                        type: "suivi",
                        mode: "edit",
                        suiviId: selectedSuivi.id,
                        initialValues: {
                          motif: selectedSuivi.motif,
                          date_ouverture: selectedSuivi.date_ouverture ?? "",
                          hypothese_diagnostic:
                            selectedSuivi.hypothese_diagnostic ?? "",
                          historique: selectedSuivi.historique ?? "",
                        },
                      })
                    }
                    type="button"
                  >
                    <Pencil className="size-[12px] text-[#0f3460]" />
                    <span className="font-['Plus_Jakarta_Sans'] text-[12px] font-medium leading-4 text-[#0f3460]">
                      Modifier
                    </span>
                  </button>

                  <button
                    className={cn(
                      "h-[29.587px] rounded-[10px] border-[0.8px] px-3 disabled:opacity-70",
                      selectedSuivi.est_actif
                        ? "cursor-pointer border-[#e7000b]"
                        : "cursor-pointer border-[#008236]",
                    )}
                    disabled={isActionPending}
                    onClick={() => {
                      if (selectedSuivi.est_actif) {
                        closeSuiviMutation.mutate(selectedSuivi.id);
                        return;
                      }
                      reactivateSuiviMutation.mutate(selectedSuivi.id);
                    }}
                    type="button"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-['Plus_Jakarta_Sans'] text-[12px] font-medium leading-4",
                        selectedSuivi.est_actif
                          ? "text-[#e7000b]"
                          : "text-[#008236]",
                      )}
                    >
                      {selectedSuivi.est_actif ? (
                        <XCircle className="size-[14px]" />
                      ) : (
                        <CheckCircle2 className="size-[14px]" />
                      )}
                      {selectedSuivi.est_actif ? "Cloturer" : "Reactiver"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-3 flex justify-end px-5">
                <div className="flex items-center gap-1 rounded-[10px] px-2.5 pt-[3px]">
                  <span className="font-['Plus_Jakarta_Sans'] text-[10px] uppercase leading-[14.286px] tracking-[0.25px] text-[rgba(100,116,139,0.9)]">
                    Ouvert le:
                  </span>
                  <span className="font-['Poppins'] text-[14px] leading-5 text-[#0f3460]">
                    {selectedSuivi.date_ouverture}
                  </span>
                </div>
              </div>

              <div className="mx-5 mt-[5px] flex min-h-[72px] flex-col gap-1 border-t-[0.8px] border-[#c2e0ef] pt-[12.8px]">
                <span className="font-['Poppins'] text-[10px] uppercase leading-[15px] tracking-[0.25px] text-[rgba(100,116,139,0.9)]">
                  Historique
                </span>
                <p className="line-clamp-2 font-['Poppins'] text-[14px] leading-5 text-[rgba(100,116,139,0.9)]">
                  {selectedSuivi.historique ||
                    "Aucun historique renseigne pour ce suivi."}
                </p>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="font-['Plus_Jakarta_Sans'] text-[14px] text-[rgba(100,116,139,0.9)]">
                Aucun suivi disponible
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-4 text-[#0f3460]" />
            <h4 className="font-['Plus_Jakarta_Sans'] text-[18px] font-normal leading-[27px] text-[#0f3460]">
              Consultations ({selectedExamens.length})
            </h4>
          </div>

          <button
            className="flex h-[46px] min-w-[260px] cursor-pointer items-center justify-center gap-[10px] rounded-[14px] bg-[#052ca0] px-6 py-3 shadow-[0px_4px_12px_0px_rgba(5,44,160,0.35)] transition-transform duration-200 ease-out hover:-translate-y-0.5"
            onClick={() =>
              openPopup({
                type: "consultation",
                mode: "create",
                suiviId: selectedSuivi?.id,
              })
            }
            type="button"
          >
            <Plus className="size-5 shrink-0 text-white" />
            <span className="whitespace-nowrap font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-6 text-white">
              Nouvelle consultation
            </span>
          </button>
        </div>

        <div className="flex w-full flex-col gap-3">
          {selectedExamens.length === 0 ? (
            <div className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white p-4">
              <p className="font-['Inter'] text-[12px] leading-4 text-[#64748b]">
                Aucune consultation pour ce suivi.
              </p>
            </div>
          ) : (
            selectedExamens.map((examen, index) => {
              const isExpanded = expandedExamenId === examen.id;
              const summary =
                examen.conclusion ||
                examen.description_consultation ||
                "Aucun detail";

              return (
                <div
                  key={examen.id}
                  className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white"
                >
                  <button
                    className="h-[71.588px] w-full cursor-pointer px-4"
                    onClick={() =>
                      setExpandedExamenId((prev) =>
                        prev === examen.id ? null : examen.id,
                      )
                    }
                    type="button"
                  >
                    <div className="flex h-full items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-[#c9e4f1]">
                        <span className="font-['Inter'] text-[12px] font-normal leading-4 text-[#265284]">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-['Inter'] text-[14px] font-normal leading-5 text-[#0f3460]">
                          Consultation du {formatDate(examen.date)}
                        </p>
                        <p className="truncate font-['Inter'] text-[12px] font-normal leading-4 text-[#64748b]">
                          {summary}
                        </p>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="size-4 text-[#64748b]" />
                      ) : (
                        <ChevronRight className="size-4 text-[#64748b]" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#c2e0ef] px-4 py-3">
                      <div className="mb-2 flex justify-end">
                        {selectedSuivi?.est_actif ? (
                          <button
                            className="inline-flex cursor-pointer items-center gap-1 rounded-[10px] border border-[#0f3460] px-3 py-1"
                            onClick={() =>
                              openPopup({
                                type: "consultation",
                                mode: "edit",
                                examenId: examen.id,
                                suiviId: examen.suivi_id,
                                initialValues: {
                                  suivi_id: examen.suivi_id,
                                  rendez_vous_id: examen.rendez_vous_id,
                                  date: examen.date ?? "",
                                  description_consultation:
                                    examen.description_consultation ?? "",
                                  conclusion: examen.conclusion ?? "",
                                  taille: examen.taille ?? "",
                                  poids: examen.poids ?? "",
                                  spo2:
                                    examen.spo2 !== null &&
                                    examen.spo2 !== undefined
                                      ? String(examen.spo2)
                                      : "",
                                  tension_arterielle:
                                    examen.tension_arterielle ?? "",
                                  frequence_cardiaque:
                                    examen.frequence_cardiaque !== null &&
                                    examen.frequence_cardiaque !== undefined
                                      ? String(examen.frequence_cardiaque)
                                      : "",
                                  temperature:
                                    examen.temperature !== null &&
                                    examen.temperature !== undefined
                                      ? String(examen.temperature)
                                      : "",
                                  aspect_general: examen.aspect_general ?? "",
                                  examen_respiratoire:
                                    examen.examen_respiratoire ?? "",
                                  examen_cardiovasculaire:
                                    examen.examen_cardiovasculaire ?? "",
                                  examen_cutane_muqueux:
                                    examen.examen_cutane_muqueux ?? "",
                                  examen_ganglionnaire:
                                    examen.examen_ganglionnaire ?? "",
                                  examen_endocrinien:
                                    examen.examen_endocrinien ?? "",
                                  examen_genital: examen.examen_genital ?? "",
                                  examen_urinaire: examen.examen_urinaire ?? "",
                                  examen_orl: examen.examen_orl ?? "",
                                  examen_digestif: examen.examen_digestif ?? "",
                                },
                              })
                            }
                            type="button"
                          >
                            <Pencil className="size-3 text-[#0f3460]" />
                            <span className="font-['Plus_Jakarta_Sans'] text-[12px] text-[#0f3460]">
                              Modifier
                            </span>
                          </button>
                        ) : (
                          <span className="rounded-[10px] border border-[#d1d5dc] px-3 py-1 font-['Plus_Jakarta_Sans'] text-[12px] text-[#6a7282]">
                            Modification indisponible (suivi cloture)
                          </span>
                        )}
                      </div>

                      <ConsultationDetail
                        aspectGeneral={examen.aspect_general}
                        conclusion={examen.conclusion}
                        examenCardiovasculaire={examen.examen_cardiovasculaire}
                        examenCutaneMuqueux={examen.examen_cutane_muqueux}
                        examenDigestif={examen.examen_digestif}
                        examenEndocrinien={examen.examen_endocrinien}
                        examenGanglionnaire={examen.examen_ganglionnaire}
                        examenGenital={examen.examen_genital}
                        examenLocomoteur={examen.examen_locomoteur}
                        examenNeurologique={examen.examen_neurologique}
                        examenOrl={examen.examen_orl}
                        examenRespiratoire={examen.examen_respiratoire}
                        examenUrinaire={examen.examen_urinaire}
                        frequenceCardiaque={
                          examen.frequence_cardiaque !== null &&
                          examen.frequence_cardiaque !== undefined
                            ? String(examen.frequence_cardiaque)
                            : undefined
                        }
                        poids={examen.poids}
                        spo2={
                          examen.spo2 !== null && examen.spo2 !== undefined
                            ? String(examen.spo2)
                            : undefined
                        }
                        taille={examen.taille}
                        temperature={
                          examen.temperature !== null &&
                          examen.temperature !== undefined
                            ? String(examen.temperature)
                            : undefined
                        }
                        tensionArterielle={examen.tension_arterielle}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function ConsultationDetail({
  taille,
  poids,
  spo2,
  temperature,
  tensionArterielle,
  frequenceCardiaque,
  aspectGeneral,
  examenRespiratoire,
  examenCardiovasculaire,
  examenCutaneMuqueux,
  examenOrl,
  examenDigestif,
  examenNeurologique,
  examenLocomoteur,
  examenGenital,
  examenUrinaire,
  examenGanglionnaire,
  examenEndocrinien,
  conclusion,
}: {
  taille?: string | null;
  poids?: string | null;
  spo2?: string | null;
  temperature?: string | null;
  tensionArterielle?: string | null;
  frequenceCardiaque?: string | null;
  aspectGeneral?: string | null;
  examenRespiratoire?: string | null;
  examenCardiovasculaire?: string | null;
  examenCutaneMuqueux?: string | null;
  examenOrl?: string | null;
  examenDigestif?: string | null;
  examenNeurologique?: string | null;
  examenLocomoteur?: string | null;
  examenGenital?: string | null;
  examenUrinaire?: string | null;
  examenGanglionnaire?: string | null;
  examenEndocrinien?: string | null;
  conclusion?: string | null;
}) {
  const vitals: Array<{ label: string; value: string | null | undefined }> = [
    { label: "TAILLE", value: taille },
    { label: "POIDS", value: poids },
    { label: "SPO2", value: spo2 },
    { label: "TEMPERATURE", value: temperature },
    { label: "TENSION ARTERIELLE", value: tensionArterielle },
    { label: "FREQUENCE CARDIAQUE", value: frequenceCardiaque },
  ].filter((item) => Boolean(item.value && item.value.trim().length > 0));

  const details: Array<{ label: string; value: string | null | undefined }> = [
    { label: "ASPECT GENERAL", value: aspectGeneral },
    { label: "EXAMEN RESPIRATOIRE", value: examenRespiratoire },
    { label: "EXAMEN CARDIOVASCULAIRE", value: examenCardiovasculaire },
    { label: "EXAMEN CUTANE / MUQUEUX", value: examenCutaneMuqueux },
    { label: "EXAMEN ORL", value: examenOrl },
    { label: "EXAMEN DIGESTIF", value: examenDigestif },
    { label: "EXAMEN NEUROLOGIQUE", value: examenNeurologique },
    { label: "EXAMEN LOCOMOTEUR", value: examenLocomoteur },
    { label: "EXAMEN GENITAL", value: examenGenital },
    { label: "EXAMEN URINAIRE", value: examenUrinaire },
    { label: "EXAMEN GANGLIONNAIRE", value: examenGanglionnaire },
    { label: "EXAMEN ENDOCRINIEN", value: examenEndocrinien },
  ].filter((item) => Boolean(item.value && item.value.trim().length > 0));

  return (
    <div className="space-y-4">
      {vitals.length > 0 && (
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 xl:grid-cols-6 xl:gap-x-4">
          {vitals.map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <span className="mt-[6px] size-[6px] shrink-0 rounded-full bg-[#0f3460]" />
              <div>
                <p className="font-['Inter'] text-[11px] font-normal uppercase tracking-[0.275px] text-[rgba(100,116,139,0.9)]">
                  {item.label}
                </p>
                <p className="font-['Inter'] text-[14px] font-normal leading-[20px] text-[rgba(100,116,139,0.9)]">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {details.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#c2e0ef] pt-3">
          {details.map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <span className="mt-[6px] size-[6px] shrink-0 rounded-full bg-[#0f3460]" />
              <div>
                <p className="font-['Inter'] text-[11px] font-normal uppercase tracking-[0.275px] text-[rgba(100,116,139,0.9)]">
                  {item.label}
                </p>
                <p className="font-['Inter'] text-[14px] font-normal leading-[20px] text-[rgba(100,116,139,0.9)]">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {conclusion?.trim() && (
        <div className="border-t border-[#c2e0ef] pt-3">
          <div className="rounded-[10px] border border-[#dbeaf3] bg-[#f6fbff] px-3 py-3">
            <p className="font-['Inter'] text-[11px] font-normal uppercase tracking-[0.275px] text-[rgba(100,116,139,0.9)]">
              Conclusion
            </p>
            <p className="mt-1 font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0f3460]">
              {conclusion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SuiviSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[288px_minmax(0,1fr)]">
      <div className="w-[288px] space-y-3">
        <Skeleton className="h-[112px] rounded-[14px]" />
        <Skeleton className="h-[112px] rounded-[14px]" />
        <Skeleton className="h-[112px] rounded-[14px]" />
        <Skeleton className="h-[46px] rounded-[14px]" />
      </div>
      <div className="min-w-0 flex-1 space-y-5">
        <Skeleton className="h-[202px] w-full rounded-[14px]" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40 rounded-[10px]" />
          <Skeleton className="h-[46px] w-[260px] rounded-[14px]" />
        </div>
        <Skeleton className="h-[71.588px] w-full rounded-[14px]" />
        <Skeleton className="h-[71.588px] w-full rounded-[14px]" />
      </div>
    </div>
  );
}

async function invalidateSuiviQueries(patientId: string) {
  await Promise.all([
    queryClient.invalidateQueries(
      trpc.consultation.getPatientSuivis.queryFilter({ patient_id: patientId }),
    ),
    queryClient.invalidateQueries(
      trpc.consultation.getExamensPatient.queryFilter({
        patient_id: patientId,
      }),
    ),
    queryClient.invalidateQueries(
      trpc.patient.getPatientFullRecord.queryFilter({ id: patientId }),
    ),
  ]);
}
