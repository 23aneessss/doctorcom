import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Edit3,
  FileUp,
  Loader2,
  Play,
  Plus,
  Save,
  Stethoscope,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import styles from "@/routes/patients/popups/nouveau-patient.module.css";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/patients/$id/rdv")({
  component: PatientRdvPage,
});

type WizardStep = 1 | 2 | 3 | 4 | 5;
type RdvDialogMode = "create" | "edit";
type RendezVousStatut = "planifie" | "confirme" | "termine" | "annule" | "non_present" | "bloque";

type RdvFormState = {
  date: string;
  heure: string;
  heureFin: string;
  statut: RendezVousStatut;
  typeCreneau: string;
  notes: string;
  important: boolean;
  frequenceRappel: string;
  periodeRappel: string;
};

type PatientRdv = {
  id: string;
  patient_id: string;
  suivi_id: string | null;
  date: string;
  heure: string;
  heure_fin: string | null;
  statut: RendezVousStatut;
  type_creneau: string | null;
  patient_label: string | null;
  patient_initials: string | null;
  couleur: string | null;
  notes: string | null;
  important: boolean;
  frequence_rappel: string | null;
  periode_rappel: string | null;
};

const WIZARD_STEPS = ["RDV", "Suivi", "Consultation", "Documents", "Terminer"] as const;
const STATUS_OPTIONS: Array<{ value: RendezVousStatut; label: string }> = [
  { value: "planifie", label: "Planifie" },
  { value: "confirme", label: "Confirme" },
  { value: "termine", label: "Termine" },
  { value: "annule", label: "Annule" },
  { value: "non_present", label: "Non present" },
  { value: "bloque", label: "Bloque" },
];

const TYPE_OPTIONS = [
  "Consultation",
  "Controle de routine",
  "Premiere consultation",
  "Suivi post-traitement",
  "Urgence",
  "Creneau bloque",
];

function PatientRdvPage() {
  const { id } = Route.useParams();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedRdvId, setSelectedRdvId] = useState("");
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDraft, setSymptomDraft] = useState("");
  const [rdvDialogMode, setRdvDialogMode] = useState<RdvDialogMode | null>(null);
  const [editingRdvId, setEditingRdvId] = useState<string | null>(null);
  const [rdvForm, setRdvForm] = useState<RdvFormState>(() => createDefaultRdvForm());

  const rdvQuery = useQuery(trpc.agenda.getRDVParPatient.queryOptions({ patient_id: id }));
  const suivisQuery = useQuery(trpc.consultation.getActiveSuivis.queryOptions({ patient_id: id }));
  const fullRecordQuery = useQuery(trpc.patient.getPatientFullRecord.queryOptions({ id }));

  const patient = fullRecordQuery.data?.patient;
  const patientLabel = patient ? `${patient.prenom} ${patient.nom}`.trim() : "Patient";
  const patientInitials = getInitials(patientLabel);
  const rdvs = useMemo(
    () =>
      ([...(rdvQuery.data ?? [])] as PatientRdv[]).sort((a, b) =>
        `${b.date} ${b.heure}`.localeCompare(`${a.date} ${a.heure}`),
      ),
    [rdvQuery.data],
  );
  const activeSuivis = suivisQuery.data ?? [];
  const selectedRdv = rdvs.find((rdv) => rdv.id === selectedRdvId) ?? null;

  const invalidateRdvData = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.agenda.getRDVParPatient.queryFilter({ patient_id: id })),
      queryClient.invalidateQueries(trpc.patient.getPatientFullRecord.queryFilter({ id })),
      queryClient.invalidateQueries(trpc.agenda.getRDVAujourdhui.queryFilter()),
      queryClient.invalidateQueries(trpc.agenda.getProchainsRDV.queryFilter({ jours: 7 })),
    ]);
  };

  const createSuiviMutation = useMutation({
    mutationFn: async () => {
      return trpcClient.consultation.createSuivi.mutate({
        patient_id: id,
        symptoms,
        date_ouverture: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: async (suivi) => {
      setSelectedSuiviId(suivi.id);
      setSymptoms([]);
      setSymptomDraft("");
      await queryClient.invalidateQueries(trpc.consultation.getActiveSuivis.queryFilter({ patient_id: id }));
      toast.success("Suivi cree");
    },
    onError: (error) => toast.error(error.message),
  });

  const workflowUpdateRdvMutation = useMutation({
    mutationFn: async (payload: { rdvId: string; suiviId?: string; status?: "termine" }) => {
      return trpcClient.agenda.modifierRDV.mutate({
        rdv_id: payload.rdvId,
        donnees: {
          suivi_id: payload.suiviId,
          statut: payload.status,
        },
      });
    },
    onSuccess: invalidateRdvData,
    onError: (error) => toast.error(error.message),
  });

  const createRdvMutation = useMutation({
    mutationFn: async (payload: RdvFormState) => {
      return trpcClient.agenda.planifierRDV.mutate(toRdvPayload(payload, {
        patientId: id,
        patientLabel,
        patientInitials,
      }));
    },
    onSuccess: async () => {
      toast.success("RDV cree avec succes");
      closeRdvDialog();
      await invalidateRdvData();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateRdvMutation = useMutation({
    mutationFn: async (payload: { rdvId: string; values: RdvFormState }) => {
      return trpcClient.agenda.modifierRDV.mutate({
        rdv_id: payload.rdvId,
        donnees: toRdvPayload(payload.values, {
          patientId: id,
          patientLabel,
          patientInitials,
        }),
      });
    },
    onSuccess: async () => {
      toast.success("RDV modifie avec succes");
      closeRdvDialog();
      await invalidateRdvData();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteRdvMutation = useMutation({
    mutationFn: async (rdvId: string) => trpcClient.agenda.deleteSlot.mutate({ id: rdvId }),
    onSuccess: async () => {
      toast.success("RDV supprime avec succes");
      await invalidateRdvData();
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateRdvDialog = () => {
    setEditingRdvId(null);
    setRdvForm(createDefaultRdvForm());
    setRdvDialogMode("create");
  };

  const openEditRdvDialog = (rdv: PatientRdv) => {
    setEditingRdvId(rdv.id);
    setRdvForm({
      date: rdv.date,
      heure: formatInputTime(rdv.heure),
      heureFin: formatInputTime(rdv.heure_fin ?? ""),
      statut: rdv.statut,
      typeCreneau: rdv.type_creneau ?? "Consultation",
      notes: rdv.notes ?? "",
      important: rdv.important,
      frequenceRappel: rdv.frequence_rappel ?? "",
      periodeRappel: rdv.periode_rappel ?? "",
    });
    setRdvDialogMode("edit");
  };

  const closeRdvDialog = () => {
    setRdvDialogMode(null);
    setEditingRdvId(null);
    setRdvForm(createDefaultRdvForm());
  };

  const submitRdvForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!rdvForm.date || !rdvForm.heure) {
      toast.error("La date et l'heure de debut sont obligatoires.");
      return;
    }

    if (rdvForm.heureFin && rdvForm.heureFin <= rdvForm.heure) {
      toast.error("L'heure de fin doit etre apres l'heure de debut.");
      return;
    }

    if (rdvDialogMode === "edit" && editingRdvId) {
      await updateRdvMutation.mutateAsync({ rdvId: editingRdvId, values: rdvForm });
      return;
    }

    await createRdvMutation.mutateAsync(rdvForm);
  };

  const deleteRdv = async (rdv: PatientRdv) => {
    const confirmed = window.confirm("Supprimer ce rendez-vous ?");
    if (!confirmed) return;
    await deleteRdvMutation.mutateAsync(rdv.id);
  };

  const openWizard = (rdvId?: string, suiviId?: string | null) => {
    const initialRdvId = rdvId ?? rdvs.find((rdv) => rdv.statut !== "termine" && rdv.statut !== "annule")?.id ?? "";
    setSelectedRdvId(initialRdvId);
    setSelectedSuiviId(suiviId ?? rdvs.find((rdv) => rdv.id === initialRdvId)?.suivi_id ?? activeSuivis[0]?.id ?? "");
    setCurrentStep(1);
    setSymptoms([]);
    setSymptomDraft("");
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setCurrentStep(1);
    setSelectedRdvId("");
    setSelectedSuiviId("");
    setSymptoms([]);
    setSymptomDraft("");
  };

  const addSymptom = () => {
    const nextValue = symptomDraft.trim();
    if (!nextValue) return;
    setSymptoms((current) => normalizeSymptoms([...current, nextValue]));
    setSymptomDraft("");
  };

  const goNext = async () => {
    if (currentStep === 1 && !selectedRdv) {
      toast.error("Selectionnez un rendez-vous.");
      return;
    }

    if (currentStep === 2) {
      if (!selectedRdv) return;
      if (!selectedSuiviId) {
        toast.error("Selectionnez ou creez un suivi.");
        return;
      }
      await workflowUpdateRdvMutation.mutateAsync({
        rdvId: selectedRdv.id,
        suiviId: selectedSuiviId,
      });
    }

    setCurrentStep((step) => Math.min(5, step + 1) as WizardStep);
  };

  const openConsultation = () => {
    if (!selectedRdv || !selectedSuiviId) {
      toast.error("Selectionnez un rendez-vous et un suivi.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail: {
          type: "consultation",
          mode: "create",
          suiviId: selectedSuiviId,
          initialValues: {
            suivi_id: selectedSuiviId,
            rendez_vous_id: selectedRdv.id,
            date: selectedRdv.date,
          },
        },
      }),
    );
  };

  const openDocuments = () => {
    window.dispatchEvent(
      new CustomEvent("patient-popup-open", {
        detail: { type: "document" },
      }),
    );
  };

  const finishRdv = async () => {
    if (!selectedRdv) return;
    await workflowUpdateRdvMutation.mutateAsync({
      rdvId: selectedRdv.id,
      suiviId: selectedSuiviId || selectedRdv.suivi_id || undefined,
      status: "termine",
    });
    toast.success("RDV termine");
    closeWizard();
  };

  const isRdvSaving = createRdvMutation.isPending || updateRdvMutation.isPending;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[#0f3460]" />
            <h2 className="font-['Plus_Jakarta_Sans'] text-[20px] font-semibold text-[#0f3460]">
              Rendez-vous patient
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[12px] border border-[#c2e0ef] bg-white px-4 font-['Inter'] text-[13px] font-semibold text-[#0f3460] shadow-[0_2px_8px_rgba(15,52,96,0.06)]"
              onClick={openCreateRdvDialog}
              type="button"
            >
              <CalendarPlus className="size-4" />
              Nouveau RDV
            </button>
            <button
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[12px] bg-[#052ca0] px-4 font-['Inter'] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(5,44,160,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={rdvs.length === 0}
              onClick={() => openWizard()}
              type="button"
            >
              <Play className="size-4" />
              Start RDV
            </button>
          </div>
        </div>

        {rdvQuery.isLoading ? (
          <div className="rounded-[14px] border border-[#c2e0ef] bg-white p-5 text-[#64748b]">Chargement...</div>
        ) : rdvs.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#c2e0ef] bg-white p-6 text-center font-['Inter'] text-[14px] text-[#64748b]">
            Aucun rendez-vous pour ce patient.
          </div>
        ) : (
          rdvs.map((rdv) => (
            <article
              key={rdv.id}
              className="rounded-[14px] border border-[#c2e0ef] bg-white p-4 transition-colors hover:bg-[#f8fbff]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#0f3460]">
                      {formatDate(rdv.date)} a {formatInputTime(rdv.heure)}
                      {rdv.heure_fin ? ` - ${formatInputTime(rdv.heure_fin)}` : ""}
                    </p>
                    <StatusBadge status={rdv.statut} />
                    {rdv.important ? (
                      <span className="rounded-full border border-[#f97316] bg-[#fff7ed] px-2.5 py-1 font-['Inter'] text-[11px] font-semibold text-[#f97316]">
                        Important
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
                    {rdv.type_creneau ?? "Consultation"}
                    {rdv.suivi_id ? " - suivi lie" : ""}
                  </p>
                  {rdv.notes ? (
                    <p className="mt-2 font-['Inter'] text-[13px] text-[#4b6787]">{rdv.notes}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <IconButton label="Modifier" onClick={() => openEditRdvDialog(rdv)}>
                    <Edit3 className="size-4" />
                  </IconButton>
                  <IconButton
                    disabled={deleteRdvMutation.isPending}
                    label="Supprimer"
                    tone="danger"
                    onClick={() => void deleteRdv(rdv)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                  <button
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[12px] bg-[#052ca0] px-4 font-['Inter'] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(5,44,160,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={rdv.statut === "termine" || rdv.statut === "annule"}
                    onClick={() => openWizard(rdv.id, rdv.suivi_id)}
                    type="button"
                  >
                    <Play className="size-4" />
                    Start
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <RdvFormDialog
        form={rdvForm}
        isSubmitting={isRdvSaving}
        mode={rdvDialogMode}
        onChange={setRdvForm}
        onClose={closeRdvDialog}
        onSubmit={submitRdvForm}
      />

      {isWizardOpen ? (
        <WorkflowDialog
          activeSuivis={activeSuivis}
          addSymptom={addSymptom}
          closeWizard={closeWizard}
          createSuiviMutationPending={createSuiviMutation.isPending}
          currentStep={currentStep}
          finishRdv={finishRdv}
          goNext={goNext}
          isUpdating={workflowUpdateRdvMutation.isPending}
          openConsultation={openConsultation}
          openDocuments={openDocuments}
          rdvs={rdvs}
          selectedRdvId={selectedRdvId}
          selectedSuiviId={selectedSuiviId}
          setCurrentStep={setCurrentStep}
          setSelectedRdvId={setSelectedRdvId}
          setSelectedSuiviId={setSelectedSuiviId}
          setSymptomDraft={setSymptomDraft}
          setSymptoms={setSymptoms}
          symptomDraft={symptomDraft}
          symptoms={symptoms}
          onCreateSuivi={() => createSuiviMutation.mutate()}
        />
      ) : null}
    </div>
  );
}

function WorkflowDialog({
  activeSuivis,
  addSymptom,
  closeWizard,
  createSuiviMutationPending,
  currentStep,
  finishRdv,
  goNext,
  isUpdating,
  openConsultation,
  openDocuments,
  rdvs,
  selectedRdvId,
  selectedSuiviId,
  setCurrentStep,
  setSelectedRdvId,
  setSelectedSuiviId,
  setSymptomDraft,
  setSymptoms,
  symptomDraft,
  symptoms,
  onCreateSuivi,
}: {
  activeSuivis: Array<{ id: string; motif?: string | null; symptoms?: string[] | null }>;
  addSymptom: () => void;
  closeWizard: () => void;
  createSuiviMutationPending: boolean;
  currentStep: WizardStep;
  finishRdv: () => Promise<void>;
  goNext: () => Promise<void>;
  isUpdating: boolean;
  openConsultation: () => void;
  openDocuments: () => void;
  rdvs: PatientRdv[];
  selectedRdvId: string;
  selectedSuiviId: string;
  setCurrentStep: (value: WizardStep | ((step: WizardStep) => WizardStep)) => void;
  setSelectedRdvId: (value: string) => void;
  setSelectedSuiviId: (value: string) => void;
  setSymptomDraft: (value: string) => void;
  setSymptoms: (value: string[] | ((current: string[]) => string[])) => void;
  symptomDraft: string;
  symptoms: string[];
  onCreateSuivi: () => void;
}) {
  const progressPercent = ((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeWizard();
      }}
    >
      <section className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerTextBlock}>
            <h3 className={styles.title}>Session RDV</h3>
            <p className={styles.subtitle}>Etape {currentStep} sur {WIZARD_STEPS.length}</p>
          </div>
          <button className={styles.closeButton} onClick={closeWizard} type="button" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </header>

        <div className={styles.progressBarTrack}>
          <span className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>

        <div className={styles.stepRail}>
          {WIZARD_STEPS.map((label, index) => {
            const step = (index + 1) as WizardStep;
            const isActive = step === currentStep;
            const isDone = step < currentStep;

            return (
              <div className={cn(styles.stepItem, index === WIZARD_STEPS.length - 1 && styles.stepItemLast)} key={label}>
                <div className={styles.stepContent}>
                  <span
                    className={cn(
                      styles.stepDot,
                      isActive && styles.stepDotActive,
                      isDone && styles.stepDotDone,
                    )}
                  >
                    {isDone ? <Check className="size-4" /> : step}
                  </span>
                  <p className={cn(styles.stepLabel, isActive && styles.stepLabelActive)}>{label}</p>
                </div>
                {index < WIZARD_STEPS.length - 1 ? (
                  <span className={cn(styles.stepConnector, isDone && styles.stepConnectorActive)} />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={styles.form}>
          <div className={styles.noticeBox}>
            <CircleHelp className="size-4 shrink-0" />
            <p>Selectionnez le rendez-vous, liez un suivi, puis creez la consultation et les documents utiles.</p>
          </div>

          <div className={styles.stepTwoContent}>
            {currentStep === 1 ? (
              <div className="grid gap-3">
                {rdvs.map((rdv) => (
                  <button
                    className={cn(
                      "rounded-[12px] border bg-white p-4 text-left transition-colors",
                      selectedRdvId === rdv.id ? "border-[#052ca0] bg-[#f0f6ff]" : "border-[#c2e0ef]",
                    )}
                    disabled={rdv.statut === "termine" || rdv.statut === "annule"}
                    key={rdv.id}
                    onClick={() => {
                      setSelectedRdvId(rdv.id);
                      setSelectedSuiviId(rdv.suivi_id ?? selectedSuiviId);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#0f3460]">
                          {formatDate(rdv.date)} a {formatInputTime(rdv.heure)}
                        </p>
                        <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
                          {rdv.type_creneau ?? "Consultation"}
                        </p>
                      </div>
                      <StatusBadge status={rdv.statut} />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="grid gap-4">
                <Field label="Suivi actif">
                  <div className={styles.selectWrap}>
                    <select className={styles.input} onChange={(event) => setSelectedSuiviId(event.target.value)} value={selectedSuiviId}>
                      <option value="">Selectionner un suivi</option>
                      {activeSuivis.map((suivi) => (
                        <option key={suivi.id} value={suivi.id}>
                          {formatSymptoms(suivi)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className={styles.selectIcon} />
                  </div>
                </Field>

                <div className="rounded-[12px] border border-[#dbe6f2] bg-white p-4">
                  <p className="font-['Plus_Jakarta_Sans'] text-[13px] font-semibold uppercase tracking-[0.3px] text-[#0f3460]">
                    Nouveau suivi
                  </p>
                  <div className="mt-3 rounded-[12px] border-[1.6px] border-[#c2e0ef] bg-white px-3 py-2">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {symptoms.map((symptom) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-[#c2e0ef] bg-[#f8fbff] px-3 py-1 text-[12px] font-semibold text-[#0f3460]"
                          key={symptom}
                        >
                          {symptom}
                          <button
                            onClick={() => setSymptoms((current) => current.filter((item) => item !== symptom))}
                            type="button"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="h-9 min-w-0 flex-1 text-[13px] text-[#0f3460] outline-none"
                        onChange={(event) => setSymptomDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addSymptom();
                          }
                        }}
                        placeholder="Ajouter un symptome puis Entrer"
                        value={symptomDraft}
                      />
                      <button
                        className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-[#eaf3fb] px-3 text-[12px] font-semibold text-[#0f3460] disabled:opacity-50"
                        disabled={!symptomDraft.trim()}
                        onClick={addSymptom}
                        type="button"
                      >
                        <Plus className="size-3" />
                        Ajouter
                      </button>
                    </div>
                  </div>
                  <button
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#0f3460] px-3 text-[12px] font-semibold text-[#0f3460] disabled:opacity-60"
                    disabled={createSuiviMutationPending || symptoms.length === 0}
                    onClick={onCreateSuivi}
                    type="button"
                  >
                    {createSuiviMutationPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Creer suivi
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <StepAction
                description="Creez la consultation liee au rendez-vous et au suivi selectionnes. Le formulaire s'ouvre au-dessus de cette session."
                icon={Stethoscope}
                label="Creer consultation"
                onClick={openConsultation}
              />
            ) : null}

            {currentStep === 4 ? (
              <StepAction
                description="Importez les documents recus pendant la visite si necessaire. Cette etape est optionnelle."
                icon={FileUp}
                label="Importer documents"
                onClick={openDocuments}
              />
            ) : null}

            {currentStep === 5 ? (
              <div className="rounded-[12px] border border-[#c2e0ef] bg-white p-5">
                <p className="font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-[#0f3460]">
                  Terminer la session
                </p>
                <p className="mt-2 font-['Inter'] text-[13px] leading-5 text-[#64748b]">
                  Le rendez-vous sera marque comme termine dans l'agenda.
                </p>
              </div>
            ) : null}
          </div>

          <footer className={styles.footer}>
            <button
              className={styles.cancelButton}
              disabled={currentStep === 1 || isUpdating}
              onClick={() => setCurrentStep((step) => Math.max(1, step - 1) as WizardStep)}
              type="button"
            >
              <ChevronLeft className="size-4" />
              Precedent
            </button>

            <div className={styles.footerActionsRight}>
              {currentStep < 5 ? (
                <button className={styles.continueButton} disabled={isUpdating} onClick={() => void goNext()} type="button">
                  Continuer
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <button className={styles.addNowButton} disabled={isUpdating} onClick={() => void finishRdv()} type="button">
                  {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Terminer RDV
                </button>
              )}
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}

function RdvFormDialog({
  form,
  isSubmitting,
  mode,
  onChange,
  onClose,
  onSubmit,
}: {
  form: RdvFormState;
  isSubmitting: boolean;
  mode: RdvDialogMode | null;
  onChange: (value: RdvFormState | ((current: RdvFormState) => RdvFormState)) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!mode) return null;

  const update = <K extends keyof RdvFormState>(field: K, value: RdvFormState[K]) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerTextBlock}>
            <h3 className={styles.title}>{mode === "edit" ? "Modifier RDV" : "Nouveau RDV"}</h3>
            <p className={styles.subtitle}>Planification du rendez-vous patient</p>
          </div>
          <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </header>

        <form className={styles.form} id="patient-rdv-form" onSubmit={onSubmit}>
          <div className={styles.noticeBox}>
            <CalendarClock className="size-4 shrink-0" />
            <p>Renseignez les informations du rendez-vous qui apparaitront dans l'agenda.</p>
          </div>

          <div className={styles.formGrid}>
            <Field label="Date">
              <input className={styles.input} onChange={(event) => update("date", event.target.value)} type="date" value={form.date} />
            </Field>
            <Field label="Statut">
              <div className={styles.selectWrap}>
                <select className={styles.input} onChange={(event) => update("statut", event.target.value as RendezVousStatut)} value={form.statut}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className={styles.selectIcon} />
              </div>
            </Field>
            <Field label="Heure debut">
              <input className={styles.input} onChange={(event) => update("heure", event.target.value)} type="time" value={form.heure} />
            </Field>
            <Field label="Heure fin">
              <input className={styles.input} onChange={(event) => update("heureFin", event.target.value)} type="time" value={form.heureFin} />
            </Field>
            <Field label="Type">
              <div className={styles.selectWrap}>
                <select className={styles.input} onChange={(event) => update("typeCreneau", event.target.value)} value={form.typeCreneau}>
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <ChevronDown className={styles.selectIcon} />
              </div>
            </Field>
            <Field label="Important">
              <label className="inline-flex min-h-[2.02rem] cursor-pointer items-center gap-3 rounded-[0.55rem] border-[1.6px] border-[#c2e0ef] bg-white px-3 text-[13px] font-semibold text-[#0f3460]">
                <input
                  checked={form.important}
                  className="peer sr-only"
                  onChange={(event) => update("important", event.target.checked)}
                  type="checkbox"
                />
                <span className="relative h-5 w-9 rounded-full bg-[#dbeaf3] transition peer-checked:bg-[#76bbdd] peer-checked:[&>span]:translate-x-4">
                  <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,52,96,0.18)] transition" />
                </span>
                {form.important ? "Oui" : "Non"}
              </label>
            </Field>
            <Field label="Frequence rappel">
              <input className={styles.input} onChange={(event) => update("frequenceRappel", event.target.value)} placeholder="Ex : 1" value={form.frequenceRappel} />
            </Field>
            <Field label="Periode rappel">
              <input className={styles.input} onChange={(event) => update("periodeRappel", event.target.value)} placeholder="Ex : jour" value={form.periodeRappel} />
            </Field>
            <div className="col-span-full">
              <Field label="Notes">
                <textarea
                  className={cn(styles.input, styles.textareaInput)}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Notes internes du rendez-vous..."
                  value={form.notes}
                />
              </Field>
            </div>
          </div>

          <footer className={styles.footer}>
            <button className={styles.cancelButton} disabled={isSubmitting} onClick={onClose} type="button">
              Annuler
            </button>
            <div className={styles.footerActionsRight}>
              <button className={styles.continueButton} disabled={isSubmitting} type="submit">
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : mode === "edit" ? <Save className="size-4" /> : <Plus className="size-4" />}
                {mode === "edit" ? "Enregistrer" : "Creer RDV"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function StepAction({
  description,
  icon: Icon,
  label,
  onClick,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[#c2e0ef] bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-[#eaf3fb] text-[#0f3460]">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-['Plus_Jakarta_Sans'] text-[16px] font-semibold text-[#0f3460]">
            {label}
          </p>
          <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#64748b]">
            {description}
          </p>
          <button
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#052ca0] px-4 text-[13px] font-semibold text-white"
            onClick={onClick}
            type="button"
          >
            <Icon className="size-4" />
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[12px] border bg-white transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger"
          ? "border-[#fecaca] text-[#e11d48] hover:bg-[#fff1f2]"
          : "border-[#c2e0ef] text-[#0f3460] hover:bg-[#f8fbff]",
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: RendezVousStatut }) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  const className =
    status === "termine"
      ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#008236]"
      : status === "confirme"
        ? "border-[#c2e0ef] bg-[#eaf3fb] text-[#265284]"
        : status === "annule" || status === "non_present"
          ? "border-[#fecaca] bg-[#fff1f2] text-[#e11d48]"
          : status === "bloque"
            ? "border-[#d1d5db] bg-[#f3f4f6] text-[#4b5563]"
            : "border-[#fed7aa] bg-[#fff7ed] text-[#f97316]";

  return (
    <span className={`inline-flex w-fit rounded-full border px-3 py-1 font-['Inter'] text-[11px] font-semibold ${className}`}>
      {option?.label ?? status}
    </span>
  );
}

function createDefaultRdvForm(): RdvFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    heure: "09:00",
    heureFin: "09:30",
    statut: "planifie",
    typeCreneau: "Consultation",
    notes: "",
    important: false,
    frequenceRappel: "",
    periodeRappel: "",
  };
}

function toRdvPayload(
  form: RdvFormState,
  patient: { patientId: string; patientLabel: string; patientInitials: string },
) {
  return {
    patient_id: patient.patientId,
    date: form.date,
    heure: form.heure,
    heure_fin: form.heureFin || null,
    statut: form.statut,
    type_creneau: form.typeCreneau.trim() || null,
    patient_label: patient.patientLabel,
    patient_initials: patient.patientInitials,
    notes: form.notes.trim() || null,
    important: form.important,
    frequence_rappel: form.frequenceRappel.trim() || null,
    periode_rappel: form.periodeRappel.trim() || null,
  };
}

function normalizeSymptoms(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function splitSymptoms(value: string): string[] {
  return normalizeSymptoms(value.split(/\r?\n|,/));
}

function formatSymptoms(suivi: { motif?: string | null; symptoms?: string[] | null }) {
  const symptoms = Array.isArray(suivi.symptoms) && suivi.symptoms.length > 0
    ? suivi.symptoms
    : splitSymptoms(suivi.motif ?? "");
  return symptoms.length > 0 ? symptoms.join(", ") : "Symptoms non renseignes";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatInputTime(value: string) {
  return value.slice(0, 5);
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "PT";
}
