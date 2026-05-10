import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, ChevronDown, Loader2, Plus, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DialogShell } from "@/routes/agenda/popups/rdv-dialog-shared";
import { trpc, trpcClient } from "@/utils/trpc";


type ConsultationDialogValues = {
  suivi_id?: string;
  rendez_vous_id?: string;
  date?: string;
  description_consultation?: string;
  conclusion?: string;
  taille?: string;
  poids?: string;
  spo2?: string;
  tension_arterielle?: string;
  frequence_cardiaque?: string;
  temperature?: string;
  aspect_general?: string;
  examen_respiratoire?: string;
  examen_cardiovasculaire?: string;
  examen_cutane_muqueux?: string;
  examen_ganglionnaire?: string;
  examen_endocrinien?: string;
  examen_genital?: string;
  examen_urinaire?: string;
  examen_orl?: string;
  examen_digestif?: string;
};

type PatientIdentity = {
  nom?: string | null;
  prenom?: string | null;
};

type RendezVousDraft = {
  date: string;
  heure: string;
  heure_fin: string;
  type_creneau: string;
  notes: string;
};

const defaultRendezVousDraft = (): RendezVousDraft => ({
  date: new Date().toISOString().slice(0, 10),
  heure: "09:00",
  heure_fin: "09:30",
  type_creneau: "Consultation",
  notes: "",
});

function buildPatientLabel(patient?: PatientIdentity | null) {
  const label = [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim();
  return label || null;
}

function buildPatientInitials(patient?: PatientIdentity | null) {
  const initials = [patient?.prenom, patient?.nom]
    .map((part) => part?.trim()?.[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return initials || null;
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function focusNextFormControl(current: HTMLElement) {
  const form = current.closest("form");
  if (!form) return;

  const controls = Array.from(
    form.querySelectorAll<HTMLElement>(
      "input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), button[type='submit']:not(:disabled)",
    ),
  ).filter((element) => element.tabIndex !== -1);
  const currentIndex = controls.indexOf(current);
  controls[currentIndex + 1]?.focus();
}

function handleEnterAsNextField(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  focusNextFormControl(event.currentTarget);
}

function isNumberInRange(value: string | undefined, min: number, max: number) {
  if (!value?.trim()) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function isBloodPressureValid(value: string | undefined) {
  if (!value?.trim()) return true;
  const normalized = value.trim();
  const match = normalized.match(/^(\d{2,3})(?:\s*[/\-]\s*(\d{2,3}))?$/);
  if (!match) return false;

  const systolic = Number(match[1]);
  const diastolic = match[2] ? Number(match[2]) : null;
  return (
    systolic >= 70 &&
    systolic <= 250 &&
    (diastolic === null || (diastolic >= 40 && diastolic <= 150))
  );
}

export function NouvelleConsultationDialog({
  open,
  onOpenChange,
  patientId,
  onCreated,
  mode = "create",
  examenId,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
  mode?: "create" | "edit";
  examenId?: string;
  values?: ConsultationDialogValues;
}) {
  const { data: activeSuivis = [], isLoading: isLoadingSuivis } = useQuery({
    ...trpc.consultation.getActiveSuivis.queryOptions({ patient_id: patientId }),
    enabled: open,
  });

  const {
    data: fullRecord,
    isLoading: isLoadingRecord,
    refetch: refetchFullRecord,
  } = useQuery({
    ...trpc.patient.getPatientFullRecord.queryOptions({ id: patientId }),
    enabled: open,
  });

  const [isCreateRdvOpen, setIsCreateRdvOpen] = useState(false);
  const [rdvDraft, setRdvDraft] = useState<RendezVousDraft>(() =>
    defaultRendezVousDraft()
  );
  const [rdvValidationError, setRdvValidationError] = useState<string | null>(
    null
  );

  const rendezVous = (fullRecord?.rendez_vous ?? []).filter(
    (rdv) =>
      rdv.statut === "planifie" || rdv.statut === "confirme" || rdv.statut === "termine"
  );
  const allSuivis = fullRecord?.suivi ?? [];

  const createExamenMutation = useMutation({
    mutationFn: async (value: ConsultationDialogValues) => {
      return trpcClient.consultation.createExamen.mutate({
        suivi_id: value.suivi_id ?? "",
        rendez_vous_id: value.rendez_vous_id ?? "",
        date: value.date ?? "",
        description_consultation: value.description_consultation?.trim() || null,
        conclusion: value.conclusion?.trim() || null,
        taille: value.taille?.trim() || null,
        poids: value.poids?.trim() || null,
        spo2: value.spo2?.trim() ? Number(value.spo2) : null,
        tension_arterielle: value.tension_arterielle?.trim() || null,
        frequence_cardiaque: value.frequence_cardiaque?.trim()
          ? Number(value.frequence_cardiaque)
          : null,
        temperature: value.temperature?.trim() ? Number(value.temperature) : null,
        aspect_general: value.aspect_general?.trim() || null,
        examen_respiratoire: value.examen_respiratoire?.trim() || null,
        examen_cardiovasculaire: value.examen_cardiovasculaire?.trim() || null,
        examen_cutane_muqueux: value.examen_cutane_muqueux?.trim() || null,
        examen_ganglionnaire: value.examen_ganglionnaire?.trim() || null,
        examen_endocrinien: value.examen_endocrinien?.trim() || null,
        examen_genital: value.examen_genital?.trim() || null,
        examen_urinaire: value.examen_urinaire?.trim() || null,
        examen_orl: value.examen_orl?.trim() || null,
        examen_digestif: value.examen_digestif?.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Consultation ajoutee avec succes");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateExamenMutation = useMutation({
    mutationFn: async (payload: {
      examenId: string;
      changes: Record<string, unknown>;
    }) => {
      return trpcClient.consultation.updateExamen.mutate({
        examen_id: payload.examenId,
        donnees: payload.changes,
      });
    },
    onSuccess: () => {
      toast.success("Consultation modifiee avec succes");
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const initialValues = useMemo<Required<ConsultationDialogValues>>(
    () => ({
      suivi_id: values?.suivi_id ?? "",
      rendez_vous_id: values?.rendez_vous_id ?? "",
      date: values?.date ?? new Date().toISOString().split("T")[0] ?? "",
      description_consultation: values?.description_consultation ?? "",
      conclusion: values?.conclusion ?? "",
      taille: values?.taille ?? "",
      poids: values?.poids ?? "",
      spo2: values?.spo2 ?? "",
      tension_arterielle: values?.tension_arterielle ?? "",
      frequence_cardiaque: values?.frequence_cardiaque ?? "",
      temperature: values?.temperature ?? "",
      aspect_general: values?.aspect_general ?? "",
      examen_respiratoire: values?.examen_respiratoire ?? "",
      examen_cardiovasculaire: values?.examen_cardiovasculaire ?? "",
      examen_cutane_muqueux: values?.examen_cutane_muqueux ?? "",
      examen_ganglionnaire: values?.examen_ganglionnaire ?? "",
      examen_endocrinien: values?.examen_endocrinien ?? "",
      examen_genital: values?.examen_genital ?? "",
      examen_urinaire: values?.examen_urinaire ?? "",
      examen_orl: values?.examen_orl ?? "",
      examen_digestif: values?.examen_digestif ?? "",
    }),
    [values]
  );

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: z.object({
        suivi_id: z.string().uuid("Selectionnez un suivi"),
        rendez_vous_id: z.string().uuid("Selectionnez un rendez-vous"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
        description_consultation: z.string(),
        conclusion: z.string(),
        taille: z.string().refine((value) => isNumberInRange(value, 30, 230), "Taille incohérente"),
        poids: z.string().refine((value) => isNumberInRange(value, 2, 350), "Poids incohérent"),
        spo2: z.union([
          z.literal(""),
          z.string().regex(/^\d+(\.\d+)?$/, "Valeur invalide").refine((value) => isNumberInRange(value, 50, 100), "SpO2 incohérente"),
        ]),
        tension_arterielle: z.string().refine(isBloodPressureValid, "Tension incohérente"),
        frequence_cardiaque: z.union([
          z.literal(""),
          z.string().regex(/^\d+$/, "Valeur invalide").refine((value) => isNumberInRange(value, 30, 220), "Fréquence incohérente"),
        ]),
        temperature: z.union([
          z.literal(""),
          z.string().regex(/^\d+(\.\d+)?$/, "Valeur invalide").refine((value) => isNumberInRange(value, 34, 43), "Température incohérente"),
        ]),
        aspect_general: z.string(),
        examen_respiratoire: z.string(),
        examen_cardiovasculaire: z.string(),
        examen_cutane_muqueux: z.string(),
        examen_ganglionnaire: z.string(),
        examen_endocrinien: z.string(),
        examen_genital: z.string(),
        examen_urinaire: z.string(),
        examen_orl: z.string(),
        examen_digestif: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      if (mode === "edit") {
        if (!examenId) {
          toast.error("Consultation introuvable pour modification");
          return;
        }

        const changes: Record<string, unknown> = {};
        const trackTextChange = (key: keyof ConsultationDialogValues) => {
          if ((value[key] ?? "").trim() !== (initialValues[key] ?? "").trim()) {
            changes[key] = (value[key] ?? "").trim() || null;
          }
        };

        if (value.date !== initialValues.date) {
          changes.date = value.date;
        }

        trackTextChange("description_consultation");
        trackTextChange("conclusion");
        trackTextChange("taille");
        trackTextChange("poids");
        trackTextChange("tension_arterielle");
        trackTextChange("aspect_general");
        trackTextChange("examen_respiratoire");
        trackTextChange("examen_cardiovasculaire");
        trackTextChange("examen_cutane_muqueux");
        trackTextChange("examen_ganglionnaire");
        trackTextChange("examen_endocrinien");
        trackTextChange("examen_genital");
        trackTextChange("examen_urinaire");
        trackTextChange("examen_orl");
        trackTextChange("examen_digestif");

        if ((value.spo2 ?? "").trim() !== (initialValues.spo2 ?? "").trim()) {
          changes.spo2 = value.spo2?.trim() ? Number(value.spo2) : null;
        }
        if (
          (value.frequence_cardiaque ?? "").trim() !==
          (initialValues.frequence_cardiaque ?? "").trim()
        ) {
          changes.frequence_cardiaque = value.frequence_cardiaque?.trim()
            ? Number(value.frequence_cardiaque)
            : null;
        }
        if (
          (value.temperature ?? "").trim() !==
          (initialValues.temperature ?? "").trim()
        ) {
          changes.temperature = value.temperature?.trim()
            ? Number(value.temperature)
            : null;
        }

        if (Object.keys(changes).length === 0) {
          toast.info("Aucune modification detectee");
          return;
        }

        await updateExamenMutation.mutateAsync({ examenId, changes });
        return;
      }

      await createExamenMutation.mutateAsync(value);
      form.reset();
    },
  });

  const createRendezVousMutation = useMutation({
    mutationFn: async () => {
      const suiviId = form.state.values.suivi_id;
      if (!suiviId) {
        throw new Error("Selectionnez un suivi avant de creer le rendez-vous.");
      }
      if (!rdvDraft.date || !rdvDraft.heure || !rdvDraft.heure_fin) {
        throw new Error("Completez la date et les horaires du rendez-vous.");
      }
      if (rdvDraft.heure_fin <= rdvDraft.heure) {
        throw new Error("L'heure de fin doit etre apres l'heure de debut.");
      }

      const patient = fullRecord?.patient as PatientIdentity | undefined;
      return trpcClient.agenda.planifierRDV.mutate({
        patient_id: patientId,
        suivi_id: suiviId,
        date: rdvDraft.date,
        heure: normalizeTime(rdvDraft.heure),
        heure_fin: normalizeTime(rdvDraft.heure_fin),
        statut: "planifie",
        type_creneau: rdvDraft.type_creneau.trim() || "Consultation",
        patient_label: buildPatientLabel(patient),
        patient_initials: buildPatientInitials(patient),
        couleur: null,
        notes: rdvDraft.notes.trim() || null,
        important: false,
        frequence_rappel: null,
        periode_rappel: null,
      });
    },
    onSuccess: async (createdRdv) => {
      await refetchFullRecord();
      form.setFieldValue("rendez_vous_id", createdRdv.id);
      form.setFieldValue("date", createdRdv.date);
      setRdvDraft((current) => ({ ...current, date: createdRdv.date }));
      setRdvValidationError(null);
      setIsCreateRdvOpen(false);
      toast.success("Rendez-vous cree avec succes");
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Le rendez-vous n'a pas pu etre cree.";
      setRdvValidationError(message);
      toast.error(message);
    },
  });

  useEffect(() => {
    form.reset(initialValues);
    setIsCreateRdvOpen(false);
    setRdvDraft(defaultRendezVousDraft());
    setRdvValidationError(null);
  }, [form, initialValues, mode, open]);

  if (!open) return null;

  const isPending =
    createExamenMutation.isPending || updateExamenMutation.isPending;
  const isCreatingRendezVous = createRendezVousMutation.isPending;
  const selectedSuiviLabel =
    allSuivis.find((s) => s.id === form.state.values.suivi_id)?.motif ||
    activeSuivis.find((s) => s.id === form.state.values.suivi_id)?.motif ||
    "—";

  return (
    <DialogShell
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-end gap-3">
            <button
              className="h-[37.6px] w-[90.582px] cursor-pointer rounded-[12px] border border-[#f77a21] font-['Plus_Jakarta_Sans'] text-[14px] font-normal leading-6 text-[#f77a21]"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Annuler
            </button>
            <form.Subscribe selector={(state) => state.values}>
              {(currentValues) => (
                <button
                  className="h-[38px] w-[226px] cursor-pointer rounded-[12px] bg-[#052ca0] font-['Inter'] text-[14px] font-normal leading-5 text-white shadow-[0px_4px_12px_rgba(5,44,160,0.4)] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
                  disabled={
                    isPending ||
                    isCreatingRendezVous ||
                    (mode === "create" && activeSuivis.length === 0) ||
                    isConsultationSubmitBlocked(currentValues)
                  }
                  form="nouvelle-consultation-form"
                  type="submit"
                >
                  {isPending
                    ? "Enregistrement..."
                    : mode === "edit"
                      ? "Enregistrer"
                      : "Creer la consultation"}
                </button>
              )}
            </form.Subscribe>
          </div>

          {mode === "create" && activeSuivis.length === 0 && (
            <p className="text-right font-['Inter'] text-[12px] text-[#dc2626]">
              Aucun suivi actif disponible. Creez d'abord un suivi.
            </p>
          )}
        </div>
      }
      icon={<Stethoscope className="size-5" />}
      maxWidth="max-w-[672px]"
      open={open}
      subtitle={`Suivi : ${selectedSuiviLabel}`}
      title={mode === "edit" ? "Modifier consultation" : "Nouvelle consultation"}
      onOpenChange={onOpenChange}
    >
        <form
          className="flex min-h-0 flex-1 flex-col"
          id="nouvelle-consultation-form"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="space-y-4">
              {(isLoadingSuivis || isLoadingRecord) && (
                <p className="font-['Inter'] text-[12px] text-[#64748b]">Chargement...</p>
              )}

              <form.Field name="date">
                {(field) => (
                  <FieldContainer label="Date" required>
                    <div className="group relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8] transition-colors duration-150 group-focus-within:text-[#76bbdd]" />
                      <input
                        className="h-[37.6px] w-full rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white pl-10 pr-3 font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color,color] duration-150 hover:border-[#9ecae0] focus:border-[#76bbdd] focus:bg-white focus:ring-4 focus:ring-[#76bbdd]/20 [&::-webkit-date-and-time-value]:font-normal [&::-webkit-datetime-edit]:font-normal"
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="date"
                        value={field.state.value}
                      />
                    </div>
                    {field.state.meta.errors[0]?.message ? (
                      <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                    ) : null}
                  </FieldContainer>
                )}
              </form.Field>

              <form.Field name="suivi_id">
                {(field) => (
                  <FieldContainer label="Suivi lie">
                    <div className="group relative">
                      <select
                        className="h-[37.6px] w-full appearance-none rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white pl-3 pr-9 font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color,color] duration-150 hover:border-[#9ecae0] focus:border-[#76bbdd] focus:bg-white focus:ring-4 focus:ring-[#76bbdd]/20 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8] [&>option]:font-normal [&>option]:text-[#0f3460]"
                        disabled={mode === "edit"}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        value={field.state.value}
                      >
                        <option className="text-[#94a3b8]" value="">
                          Selectionner un suivi
                        </option>
                        {activeSuivis.map((suivi) => (
                          <option key={suivi.id} value={suivi.id}>
                            {suivi.motif}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8] transition-colors duration-150 group-hover:text-[#64748b] group-focus-within:text-[#76bbdd]" />
                    </div>
                    {field.state.meta.errors[0]?.message ? (
                      <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                    ) : null}
                  </FieldContainer>
                )}
              </form.Field>

              <form.Field name="rendez_vous_id">
                {(field) => (
                  <FieldContainer label="Rendez-vous lie">
                    <div className="group relative">
                      <select
                        className="h-[37.6px] w-full appearance-none rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white pl-3 pr-9 font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color,color] duration-150 hover:border-[#9ecae0] focus:border-[#76bbdd] focus:bg-white focus:ring-4 focus:ring-[#76bbdd]/20 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8] [&>option]:font-normal [&>option]:text-[#0f3460]"
                        disabled={mode === "edit"}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        value={field.state.value}
                      >
                        <option className="text-[#94a3b8]" value="">
                          Selectionner un rendez-vous
                        </option>
                        {rendezVous.map((rdv) => (
                          <option key={rdv.id} value={rdv.id}>
                            {new Date(rdv.date).toLocaleDateString("fr-FR")} - {rdv.heure}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8] transition-colors duration-150 group-hover:text-[#64748b] group-focus-within:text-[#76bbdd]" />
                    </div>
                    {field.state.meta.errors[0]?.message ? (
                      <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                    ) : null}
                    {mode === "create" ? (
                      <div className="mt-2 rounded-[12px] border border-[#c2e0ef] bg-[#f8fafc] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-['Inter'] text-[12px] font-medium text-[#0f3460]">
                            Rendez-vous de consultation
                          </p>
                          <button
                            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[#76bbdd] bg-white px-3 font-['Inter'] text-[12px] font-semibold text-[#0f3460] transition-colors hover:bg-[#eef8fd]"
                            onClick={() => {
                              setIsCreateRdvOpen((value) => !value);
                              setRdvValidationError(null);
                              setRdvDraft((current) => ({
                                ...current,
                                date: form.state.values.date || current.date,
                              }));
                            }}
                            type="button"
                          >
                            <Plus className="size-3.5" />
                            Creer un RDV
                          </button>
                        </div>

                        {isCreateRdvOpen ? (
                          <div className="mt-3 grid gap-3">
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                className="h-[34px] rounded-[10px] border border-[#c2e0ef] bg-white px-2 font-['Inter'] text-[13px] text-[#0f3460] outline-none focus:border-[#76bbdd] focus:ring-2 focus:ring-[#76bbdd]/20"
                                onChange={(event) =>
                                  setRdvDraft((current) => ({
                                    ...current,
                                    date: event.target.value,
                                  }))
                                }
                                type="date"
                                value={rdvDraft.date}
                              />
                              <input
                                className="h-[34px] rounded-[10px] border border-[#c2e0ef] bg-white px-2 font-['Inter'] text-[13px] text-[#0f3460] outline-none focus:border-[#76bbdd] focus:ring-2 focus:ring-[#76bbdd]/20"
                                onChange={(event) =>
                                  setRdvDraft((current) => ({
                                    ...current,
                                    heure: event.target.value,
                                  }))
                                }
                                type="time"
                                value={rdvDraft.heure}
                              />
                              <input
                                className="h-[34px] rounded-[10px] border border-[#c2e0ef] bg-white px-2 font-['Inter'] text-[13px] text-[#0f3460] outline-none focus:border-[#76bbdd] focus:ring-2 focus:ring-[#76bbdd]/20"
                                onChange={(event) =>
                                  setRdvDraft((current) => ({
                                    ...current,
                                    heure_fin: event.target.value,
                                  }))
                                }
                                type="time"
                                value={rdvDraft.heure_fin}
                              />
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                              <input
                                className="h-[34px] rounded-[10px] border border-[#c2e0ef] bg-white px-2 font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8] focus:border-[#76bbdd] focus:ring-2 focus:ring-[#76bbdd]/20"
                                onChange={(event) =>
                                  setRdvDraft((current) => ({
                                    ...current,
                                    notes: event.target.value,
                                  }))
                                }
                                placeholder="Notes"
                                value={rdvDraft.notes}
                              />
                              <form.Subscribe selector={(state) => state.values.suivi_id}>
                                {(suiviId) => (
                                  <button
                                    className="inline-flex h-[34px] min-w-[118px] items-center justify-center gap-2 rounded-[10px] bg-[#76bbdd] px-3 font-['Inter'] text-[12px] font-semibold text-white shadow-[0_3px_8px_rgba(118,187,221,0.35)] disabled:cursor-not-allowed disabled:bg-[#c2e0ef] disabled:text-[#6b819d] disabled:shadow-none"
                                    disabled={
                                      isCreatingRendezVous ||
                                      !suiviId ||
                                      !rdvDraft.date ||
                                      !rdvDraft.heure ||
                                      !rdvDraft.heure_fin ||
                                      rdvDraft.heure_fin <= rdvDraft.heure
                                    }
                                    onClick={() => {
                                      setRdvValidationError(null);
                                      createRendezVousMutation.mutate();
                                    }}
                                    type="button"
                                  >
                                    {isCreatingRendezVous ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : null}
                                    Enregistrer
                                  </button>
                                )}
                              </form.Subscribe>
                            </div>
                            {rdvValidationError ? (
                              <p className="font-['Inter'] text-[12px] text-[#dc2626]">
                                {rdvValidationError}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </FieldContainer>
                )}
              </form.Field>

              <form.Field name="description_consultation">
                {(field) => (
                  <FieldContainer label="description consultation">
                    <textarea
                      className="h-[77.6px] w-full resize-none rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color,color] duration-150 placeholder:text-[rgba(10,10,10,0.5)] hover:border-[#9ecae0] focus:border-[#76bbdd] focus:bg-white focus:ring-4 focus:ring-[#76bbdd]/20"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="description de la consultation"
                      value={field.state.value}
                    />
                    {field.state.meta.errors[0]?.message ? (
                      <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                    ) : null}
                  </FieldContainer>
                )}
              </form.Field>

              <div className="rounded-[12px] border border-[#c2e0ef]">
                <div className="border-b border-[#c2e0ef] px-4 py-2">
                  <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-[16px] tracking-[0.3px] text-[#0f3460] uppercase">
                    Examen clinique
                  </p>
                </div>
                <div className="space-y-[14px] px-4 py-4">
                  <div className="grid grid-cols-3 gap-3">
                    <form.Field name="taille">
                      {(field) => (
                        <InputField
                          label="Taille"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="poids">
                      {(field) => (
                        <InputField
                          label="Poids"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="spo2">
                      {(field) => (
                        <InputField
                          label="SpO2"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <form.Field name="tension_arterielle">
                      {(field) => (
                        <InputField
                          label="Tension arterielle"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="frequence_cardiaque">
                      {(field) => (
                        <InputField
                          label="Frequence cardiaque"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="temperature">
                      {(field) => (
                        <InputField
                          label="Temperature"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <form.Field name="aspect_general">
                      {(field) => (
                        <InputField
                          label="Aspect general"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_respiratoire">
                      {(field) => (
                        <InputField
                          label="Examen respiratoire"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_cardiovasculaire">
                      {(field) => (
                        <InputField
                          label="Examen cardiovasculaire"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_cutane_muqueux">
                      {(field) => (
                        <InputField
                          label="Examen cutane / muqueux"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_ganglionnaire">
                      {(field) => (
                        <InputField
                          label="Examen ganglionnaire"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_endocrinien">
                      {(field) => (
                        <InputField
                          label="Examen endocrinien"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_genital">
                      {(field) => (
                        <InputField
                          label="Examen genital"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_urinaire">
                      {(field) => (
                        <InputField
                          label="Examen urinaire"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_orl">
                      {(field) => (
                        <InputField
                          label="Examen ORL"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                    <form.Field name="examen_digestif">
                      {(field) => (
                        <InputField
                          label="Examen digestif"
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                  </div>
                </div>
              </div>

              <form.Field name="conclusion">
                {(field) => (
                  <FieldContainer label="Diagnostique">
                    <textarea
                      className="h-[77.6px] w-full resize-none rounded-[12px] border-[0.8px] border-[#c2e0ef] bg-white px-3 py-2 font-['Inter'] text-[14px] font-normal leading-[20px] text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color,color] duration-150 placeholder:text-[rgba(10,10,10,0.5)] hover:border-[#9ecae0] focus:border-[#76bbdd] focus:bg-white focus:ring-4 focus:ring-[#76bbdd]/20"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Diagnostique de la consultation..."
                      value={field.state.value}
                    />
                    {field.state.meta.errors[0]?.message ? (
                      <p className="text-xs text-red-600">{field.state.meta.errors[0].message}</p>
                    ) : null}
                  </FieldContainer>
                )}
              </form.Field>
          </div>
        </form>
    </DialogShell>
  );
}

function isConsultationSubmitBlocked(values: ConsultationDialogValues) {
  const hasRequiredLinks =
    Boolean(values.suivi_id?.trim()) && Boolean(values.rendez_vous_id?.trim());
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(values.date ?? "");
  const hasValidHeight = isNumberInRange(values.taille, 30, 230);
  const hasValidWeight = isNumberInRange(values.poids, 2, 350);
  const hasValidSpo2 =
    (!values.spo2 || /^\d+(\.\d+)?$/.test(values.spo2)) &&
    isNumberInRange(values.spo2, 50, 100);
  const hasValidBloodPressure = isBloodPressureValid(values.tension_arterielle);
  const hasValidHeartRate =
    (!values.frequence_cardiaque || /^\d+$/.test(values.frequence_cardiaque)) &&
    isNumberInRange(values.frequence_cardiaque, 30, 220);
  const hasValidTemperature =
    (!values.temperature || /^\d+(\.\d+)?$/.test(values.temperature)) &&
    isNumberInRange(values.temperature, 34, 43);

  return !hasRequiredLinks || !hasValidDate || !hasValidHeight || !hasValidWeight || !hasValidSpo2 || !hasValidBloodPressure || !hasValidHeartRate || !hasValidTemperature;
}

function FieldContainer({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="font-['Plus_Jakarta_Sans'] text-[14px] font-semibold leading-[16px] tracking-[0.3px] text-[#0f3460] uppercase">
        {label}
        {required ? <span className="text-[#ff6467]">*</span> : null}
      </p>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="font-['Plus_Jakarta_Sans'] text-[12px] font-medium leading-[16px] text-[#052ca0]">
        {label}
      </p>
      <input
        className="h-[33.6px] w-full rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white px-3 font-['Inter'] text-[14px] font-normal leading-[normal] text-[#0f3460] shadow-[0_1px_2px_rgba(15,52,96,0.08)] outline-none transition-[border-color,box-shadow,background-color,color] duration-150 placeholder:text-[rgba(10,10,10,0.5)] hover:border-[#9ecae0] focus:border-[#76bbdd] focus:bg-white focus:ring-4 focus:ring-[#76bbdd]/20"
        onBlur={onBlur}
        onChange={onChange}
        onKeyDown={handleEnterAsNextField}
        value={value}
      />
    </div>
  );
}
