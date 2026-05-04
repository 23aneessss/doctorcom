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
  Clock,
  Edit3,
  FileText,
  FileUp,
  Loader2,
  Play,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";
import {
  DialogShell,
  Field,
  TimeField,
  fieldControlClassName,
} from "@/routes/agenda/popups/rdv-dialog-shared";

export const Route = createFileRoute("/patients/$id/rdv")({
  component: PatientRdvPage,
});

type RendezVousStatut =
  | "planifie"
  | "confirme"
  | "termine"
  | "annule"
  | "non_present"
  | "bloque";

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

type RdvFormState = {
  date: string;
  heure: string;
  heureFin: string;
  statut: RendezVousStatut;
  typeCreneau: string;
  notes: string;
  important: boolean;
};

const STATUS_OPTIONS: Array<{ value: RendezVousStatut; label: string }> = [
  { value: "planifie", label: "Planifié" },
  { value: "confirme", label: "Confirmé" },
  { value: "termine", label: "Terminé" },
  { value: "annule", label: "Annulé" },
  { value: "non_present", label: "Non présent" },
  { value: "bloque", label: "Bloqué" },
];

const TYPE_OPTIONS = [
  "Consultation",
  "Contrôle de routine",
  "Première consultation",
  "Suivi post-traitement",
  "Urgence",
  "Créneau bloqué",
];

const STEPS_FULL = ["Rendez-vous", "Suivi", "Consultation", "Documents", "Terminer"] as const;
const STEPS_SHORT = ["Suivi", "Consultation", "Documents", "Terminer"] as const;

type WizardStep = 1 | 2 | 3 | 4 | 5;

function createDefaultForm(): RdvFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    heure: "09:00",
    heureFin: "09:30",
    statut: "planifie",
    typeCreneau: "Consultation",
    notes: "",
    important: false,
  };
}

function PatientRdvPage() {
  const { id } = Route.useParams();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRdv, setEditingRdv] = useState<PatientRdv | null>(null);
  const [rdvForm, setRdvForm] = useState<RdvFormState>(createDefaultForm);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardSkipsRdv, setWizardSkipsRdv] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedRdvId, setSelectedRdvId] = useState("");
  const [selectedSuiviId, setSelectedSuiviId] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDraft, setSymptomDraft] = useState("");

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

  const activeSuivis = (suivisQuery.data ?? []) as Array<{
    id: string;
    motif?: string | null;
    symptoms?: string[] | null;
  }>;
  const selectedRdv = rdvs.find((r) => r.id === selectedRdvId) ?? null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.agenda.getRDVParPatient.queryFilter({ patient_id: id })),
      queryClient.invalidateQueries(trpc.patient.getPatientFullRecord.queryFilter({ id })),
      queryClient.invalidateQueries(trpc.agenda.getRDVAujourdhui.queryFilter()),
      queryClient.invalidateQueries(trpc.agenda.getProchainsRDV.queryFilter({ jours: 7 })),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (form: RdvFormState) =>
      trpcClient.agenda.planifierRDV.mutate({
        patient_id: id,
        date: form.date,
        heure: form.heure,
        heure_fin: form.heureFin || null,
        statut: form.statut,
        type_creneau: form.typeCreneau.trim() || null,
        patient_label: patientLabel,
        patient_initials: patientInitials,
        notes: form.notes.trim() || null,
        important: form.important,
        frequence_rappel: null,
        periode_rappel: null,
      }),
    onSuccess: async () => {
      toast.success("Rendez-vous créé");
      setIsCreateOpen(false);
      setRdvForm(createDefaultForm());
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { rdvId: string; form: RdvFormState }) =>
      trpcClient.agenda.modifierRDV.mutate({
        rdv_id: payload.rdvId,
        donnees: {
          date: payload.form.date,
          heure: payload.form.heure,
          heure_fin: payload.form.heureFin || null,
          statut: payload.form.statut,
          type_creneau: payload.form.typeCreneau.trim() || null,
          notes: payload.form.notes.trim() || null,
          important: payload.form.important,
        },
      }),
    onSuccess: async () => {
      toast.success("Rendez-vous modifié");
      setEditingRdv(null);
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (rdvId: string) => trpcClient.agenda.deleteSlot.mutate({ id: rdvId }),
    onSuccess: async () => {
      toast.success("Rendez-vous supprimé");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const workflowUpdateMutation = useMutation({
    mutationFn: (payload: { rdvId: string; suiviId?: string; status?: "termine" }) =>
      trpcClient.agenda.modifierRDV.mutate({
        rdv_id: payload.rdvId,
        donnees: {
          suivi_id: payload.suiviId,
          statut: payload.status,
        },
      }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  const createSuiviMutation = useMutation({
    mutationFn: () =>
      trpcClient.consultation.createSuivi.mutate({
        patient_id: id,
        symptoms,
        date_ouverture: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: async (suivi) => {
      setSelectedSuiviId(suivi.id);
      setSymptoms([]);
      setSymptomDraft("");
      await queryClient.invalidateQueries(
        trpc.consultation.getActiveSuivis.queryFilter({ patient_id: id }),
      );
      toast.success("Suivi créé");
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreate = () => {
    setRdvForm(createDefaultForm());
    setIsCreateOpen(true);
  };

  const openEdit = (rdv: PatientRdv) => {
    setEditingRdv(rdv);
    setRdvForm({
      date: rdv.date,
      heure: rdv.heure.slice(0, 5),
      heureFin: (rdv.heure_fin ?? "").slice(0, 5),
      statut: rdv.statut,
      typeCreneau: rdv.type_creneau ?? "Consultation",
      notes: rdv.notes ?? "",
      important: rdv.important,
    });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rdvForm.date || !rdvForm.heure) {
      toast.error("La date et l'heure de début sont obligatoires.");
      return;
    }
    if (rdvForm.heureFin && rdvForm.heureFin <= rdvForm.heure) {
      toast.error("L'heure de fin doit être après l'heure de début.");
      return;
    }
    if (editingRdv) {
      await updateMutation.mutateAsync({ rdvId: editingRdv.id, form: rdvForm });
    } else {
      await createMutation.mutateAsync(rdvForm);
    }
  };

  const deleteRdv = async (rdv: PatientRdv) => {
    if (!window.confirm("Supprimer ce rendez-vous ?")) return;
    await deleteMutation.mutateAsync(rdv.id);
  };

  const openWizard = (rdv?: PatientRdv) => {
    if (rdv) {
      setWizardSkipsRdv(true);
      setSelectedRdvId(rdv.id);
      setSelectedSuiviId(rdv.suivi_id ?? activeSuivis[0]?.id ?? "");
    } else {
      setWizardSkipsRdv(false);
      const firstActive = rdvs.find((r) => r.statut !== "termine" && r.statut !== "annule");
      setSelectedRdvId(firstActive?.id ?? "");
      setSelectedSuiviId(firstActive?.suivi_id ?? activeSuivis[0]?.id ?? "");
    }
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

  const goNext = async () => {
    const backendStep = wizardSkipsRdv ? currentStep + 1 : currentStep;

    if (backendStep === 1 && !selectedRdv) {
      toast.error("Sélectionnez un rendez-vous.");
      return;
    }

    if (backendStep === 2) {
      if (!selectedRdv) return;
      if (!selectedSuiviId) {
        toast.error("Sélectionnez ou créez un suivi.");
        return;
      }
      await workflowUpdateMutation.mutateAsync({
        rdvId: selectedRdv.id,
        suiviId: selectedSuiviId,
      });
    }

    const maxStep = wizardSkipsRdv ? 4 : 5;
    setCurrentStep((s) => Math.min(maxStep, s + 1) as WizardStep);
  };

  const goPrev = () => {
    setCurrentStep((s) => Math.max(1, s - 1) as WizardStep);
  };

  const openConsultation = () => {
    if (!selectedRdv || !selectedSuiviId) {
      toast.error("Sélectionnez un rendez-vous et un suivi.");
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
      new CustomEvent("patient-popup-open", { detail: { type: "document" } }),
    );
  };

  const finishRdv = async () => {
    if (!selectedRdv) return;
    await workflowUpdateMutation.mutateAsync({
      rdvId: selectedRdv.id,
      suiviId: selectedSuiviId || selectedRdv.suivi_id || undefined,
      status: "termine",
    });
    toast.success("Consultation terminée");
    closeWizard();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const wizardSteps = wizardSkipsRdv ? STEPS_SHORT : STEPS_FULL;
  const maxStep = wizardSkipsRdv ? 4 : 5;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <section className="rounded-[14px] border-[0.8px] border-[#c2e0ef] bg-white px-4 py-5 shadow-[0px_4px_6px_0px_rgba(118,187,221,0.2),0px_2px_4px_0px_rgba(118,187,221,0.2)] sm:px-[24.8px] sm:pt-[24.8px]">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-[8px]">
            <CalendarClock className="size-5 shrink-0 text-[#052ca0]" />
            <div className="min-w-0">
              <h2 className="font-['Inter'] text-[20px] font-medium leading-7 text-[#052ca0]">
                Rendez-vous
              </h2>
              <p className="font-['Inter'] text-[13px] leading-5 text-[#6b819d]">
                {rdvs.length > 0
                  ? `${rdvs.length} rendez-vous enregistré${rdvs.length > 1 ? "s" : ""}`
                  : "Aucun rendez-vous enregistré pour ce patient."}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.4px] border-[#c2e0ef] bg-white px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-[#265284] transition-colors hover:bg-[#f0f6ff] sm:w-auto"
              onClick={openCreate}
              type="button"
            >
              <CalendarPlus className="size-4 shrink-0" />
              Nouveau rendez-vous
            </button>
            <button
              className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#052ca0] px-5 font-['Plus_Jakarta_Sans'] text-[14px] font-semibold text-white shadow-[0px_4px_12px_0px_rgba(5,44,160,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#082f9e] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={rdvs.length === 0}
              onClick={() => openWizard()}
              type="button"
            >
              <Play className="size-4 shrink-0" />
              Démarrer la consultation
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {rdvQuery.isLoading ? (
            <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
              <Loader2 className="size-5 animate-spin text-[#76bbdd]" />
            </div>
          ) : rdvs.length === 0 ? (
            <div className="flex h-[154px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb] px-4 text-center">
              <span className="font-['Inter'] text-[14px] leading-5 text-[#64748b]">
                Aucun rendez-vous pour ce patient.
              </span>
            </div>
          ) : (
            rdvs.map((rdv) => {
              const isActionable = rdv.statut !== "termine" && rdv.statut !== "annule";
              return (
                <article
                  key={rdv.id}
                  className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f8fafc] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">
                          {formatDate(rdv.date)} à {rdv.heure.slice(0, 5)}
                          {rdv.heure_fin ? ` – ${rdv.heure_fin.slice(0, 5)}` : ""}
                        </p>
                        <RdvStatusBadge status={rdv.statut} />
                        {rdv.important ? (
                          <span className="rounded-full border border-[#f97316] bg-[#fff7ed] px-2 py-0.5 font-['Inter'] text-[11px] font-semibold text-[#f97316]">
                            Important
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-['Inter'] text-[12px] text-[#64748b]">
                        {rdv.type_creneau ?? "Consultation"}
                        {rdv.suivi_id ? " · suivi lié" : ""}
                      </p>
                      {rdv.notes ? (
                        <p className="mt-2 line-clamp-2 font-['Inter'] text-[12px] leading-5 text-[#4b6787]">
                          {rdv.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        aria-label="Modifier"
                        className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#c2e0ef] bg-white text-[#0f3460] transition-colors hover:bg-[#f8fbff]"
                        onClick={() => openEdit(rdv)}
                        type="button"
                      >
                        <Edit3 className="size-4" />
                      </button>
                      <button
                        aria-label="Supprimer"
                        className="flex size-[35.2px] cursor-pointer items-center justify-center rounded-[10px] border-[1.6px] border-[#fecaca] bg-white text-[#e11d48] transition-colors hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deleteMutation.isPending}
                        onClick={() => void deleteRdv(rdv)}
                        type="button"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      {isActionable ? (
                        <button
                          className="flex h-[35px] cursor-pointer items-center gap-1.5 rounded-[10px] bg-[#052ca0] px-3 font-['Inter'] text-[12px] font-semibold text-white shadow-[0px_3px_8px_rgba(5,44,160,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[#082f9e]"
                          onClick={() => openWizard(rdv)}
                          type="button"
                        >
                          <Play className="size-3.5" />
                          Démarrer
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <NouveauRdvDialog
        editingRdv={editingRdv}
        form={rdvForm}
        isOpen={isCreateOpen || editingRdv !== null}
        isSaving={isSaving}
        patientInitials={patientInitials}
        patientLabel={patientLabel}
        onChange={setRdvForm}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingRdv(null);
        }}
        onSubmit={submitForm}
      />

      {isWizardOpen ? (
        <WorkflowDialog
          activeSuivis={activeSuivis}
          currentStep={currentStep}
          finishRdv={finishRdv}
          goNext={goNext}
          goPrev={goPrev}
          isUpdating={workflowUpdateMutation.isPending || createSuiviMutation.isPending}
          maxStep={maxStep}
          openConsultation={openConsultation}
          openDocuments={openDocuments}
          rdvs={rdvs}
          selectedRdvId={selectedRdvId}
          selectedSuiviId={selectedSuiviId}
          skipsRdv={wizardSkipsRdv}
          steps={wizardSteps}
          symptomDraft={symptomDraft}
          symptoms={symptoms}
          onAddSymptom={() => {
            const v = symptomDraft.trim();
            if (!v) return;
            setSymptoms((cur) => normalizeSymptoms([...cur, v]));
            setSymptomDraft("");
          }}
          onClose={closeWizard}
          onCreateSuivi={() => createSuiviMutation.mutate()}
          onRemoveSymptom={(sym) => setSymptoms((cur) => cur.filter((s) => s !== sym))}
          onSelectRdv={(rdvId) => {
            setSelectedRdvId(rdvId);
            const rdv = rdvs.find((r) => r.id === rdvId);
            if (rdv?.suivi_id) setSelectedSuiviId(rdv.suivi_id);
          }}
          onSelectSuivi={setSelectedSuiviId}
          onSetSymptomDraft={setSymptomDraft}
        />
      ) : null}
    </div>
  );
}

// ─── Nouveau RDV Dialog ─────────────────────────────────────────────────────

function NouveauRdvDialog({
  editingRdv,
  form,
  isOpen,
  isSaving,
  patientInitials,
  patientLabel,
  onChange,
  onClose,
  onSubmit,
}: {
  editingRdv: PatientRdv | null;
  form: RdvFormState;
  isOpen: boolean;
  isSaving: boolean;
  patientInitials: string;
  patientLabel: string;
  onChange: (v: RdvFormState | ((c: RdvFormState) => RdvFormState)) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const set = <K extends keyof RdvFormState>(k: K, v: RdvFormState[K]) =>
    onChange((c) => ({ ...c, [k]: v }));

  const isEdit = editingRdv !== null;

  return (
    <DialogShell
      footer={
        <>
          <button
            className="h-[38px] cursor-pointer rounded-[12px] border border-[#f77a21] px-4 font-['Plus_Jakarta_Sans'] text-[14px] font-medium text-[#f77a21] transition-colors hover:bg-[#fff7ed] disabled:opacity-60"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Annuler
          </button>
          <button
            className="inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-[#052ca0] px-5 font-['Inter'] text-[14px] font-medium text-white shadow-[0px_4px_12px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#082f9e] disabled:opacity-60"
            disabled={isSaving}
            form="patient-rdv-form"
            type="submit"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {isEdit ? "Enregistrer" : "Créer le rendez-vous"}
          </button>
        </>
      }
      icon={<CalendarPlus className="size-5" />}
      maxWidth="max-w-[620px]"
      open={isOpen}
      subtitle="Planification du rendez-vous patient"
      title={isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form className="space-y-5" id="patient-rdv-form" onSubmit={onSubmit}>
        {/* Patient preview card */}
        <div className="rounded-[18px] border border-[#c2e0ef] bg-gradient-to-br from-[rgba(194,224,239,0.42)] to-white p-4 shadow-[0_10px_30px_rgba(15,52,96,0.08)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[#052ca0] bg-white font-['Inter'] text-[14px] font-bold text-[#052ca0]">
              {patientInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-['Plus_Jakarta_Sans'] text-[16px] font-bold text-[#0f3460]">
                {patientLabel}
              </p>
              <p className="mt-0.5 font-['Inter'] text-[12px] text-[#64748b]">
                {form.typeCreneau} · {form.heure}{form.heureFin ? ` – ${form.heureFin}` : ""}
              </p>
            </div>
            <span className={cn(
              "ml-auto shrink-0 inline-flex h-7 items-center rounded-full border px-3 font-['Inter'] text-[12px] font-semibold",
              statusBadgeClass(form.statut),
            )}>
              {STATUS_OPTIONS.find((o) => o.value === form.statut)?.label ?? form.statut}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <div className="relative">
              <select
                className={cn(fieldControlClassName, "appearance-none pr-9")}
                onChange={(e) => set("typeCreneau", e.target.value)}
                value={form.typeCreneau}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </Field>

          <Field label="Statut" required>
            <div className="relative">
              <select
                className={cn(fieldControlClassName, "appearance-none pr-9")}
                onChange={(e) => set("statut", e.target.value as RendezVousStatut)}
                value={form.statut}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </Field>

          <Field label="Date" required>
            <div className="relative">
              <CalendarPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                className={cn(fieldControlClassName, "pl-10")}
                onChange={(e) => set("date", e.target.value)}
                type="date"
                value={form.date}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Début" required>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
                <TimeField
                  ariaLabel="Heure de début"
                  className="pl-10"
                  value={form.heure}
                  onChange={(v) => set("heure", v)}
                />
              </div>
            </Field>
            <Field label="Fin">
              <TimeField
                ariaLabel="Heure de fin"
                value={form.heureFin}
                onChange={(v) => set("heureFin", v)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Important">
              <label className={cn(
                fieldControlClassName,
                "inline-flex cursor-pointer items-center gap-3",
              )}>
                <input
                  checked={form.important}
                  className="peer sr-only"
                  onChange={(e) => set("important", e.target.checked)}
                  type="checkbox"
                />
                <span className="relative h-5 w-9 rounded-full bg-[#dbeaf3] transition peer-checked:bg-[#052ca0]">
                  <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,52,96,0.18)] transition peer-checked:translate-x-4 [.peer:checked~&]:translate-x-4" />
                </span>
                <span className="font-['Inter'] text-[13px] text-[#0f3460]">
                  {form.important ? "Marquer comme important" : "Normal"}
                </span>
              </label>
            </Field>
          </div>
        </div>

        <Field label="Notes">
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-3 size-4 text-[#94a3b8]" />
            <textarea
              className={cn(
                fieldControlClassName,
                "min-h-[88px] resize-none pl-10 pt-2.5",
              )}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notes internes, préparation, documents à demander..."
              value={form.notes}
            />
          </div>
        </Field>
      </form>
    </DialogShell>
  );
}

// ─── Workflow Dialog ─────────────────────────────────────────────────────────

function WorkflowDialog({
  activeSuivis,
  currentStep,
  finishRdv,
  goNext,
  goPrev,
  isUpdating,
  maxStep,
  openConsultation,
  openDocuments,
  rdvs,
  selectedRdvId,
  selectedSuiviId,
  skipsRdv,
  steps,
  symptomDraft,
  symptoms,
  onAddSymptom,
  onClose,
  onCreateSuivi,
  onRemoveSymptom,
  onSelectRdv,
  onSelectSuivi,
  onSetSymptomDraft,
}: {
  activeSuivis: Array<{ id: string; motif?: string | null; symptoms?: string[] | null }>;
  currentStep: WizardStep;
  finishRdv: () => Promise<void>;
  goNext: () => Promise<void>;
  goPrev: () => void;
  isUpdating: boolean;
  maxStep: number;
  openConsultation: () => void;
  openDocuments: () => void;
  rdvs: PatientRdv[];
  selectedRdvId: string;
  selectedSuiviId: string;
  skipsRdv: boolean;
  steps: readonly string[];
  symptomDraft: string;
  symptoms: string[];
  onAddSymptom: () => void;
  onClose: () => void;
  onCreateSuivi: () => void;
  onRemoveSymptom: (sym: string) => void;
  onSelectRdv: (id: string) => void;
  onSelectSuivi: (id: string) => void;
  onSetSymptomDraft: (v: string) => void;
}) {
  const backendStep = skipsRdv ? currentStep + 1 : currentStep;
  const selectedRdv = rdvs.find((r) => r.id === selectedRdvId) ?? null;

  return (
    <DialogShell
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            className="flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[12px] border border-[#c2e0ef] bg-white px-4 font-['Inter'] text-[13px] font-medium text-[#0f3460] transition-colors hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentStep === 1 || isUpdating}
            onClick={goPrev}
            type="button"
          >
            <ChevronLeft className="size-4" />
            Précédent
          </button>

          {currentStep < maxStep ? (
            <button
              className="flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[12px] bg-[#052ca0] px-5 font-['Inter'] text-[13px] font-semibold text-white shadow-[0px_4px_12px_rgba(5,44,160,0.4)] transition-colors hover:bg-[#082f9e] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUpdating}
              onClick={() => void goNext()}
              type="button"
            >
              {isUpdating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Continuer
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[12px] bg-[#008236] px-5 font-['Inter'] text-[13px] font-semibold text-white shadow-[0px_4px_12px_rgba(0,130,54,0.35)] transition-colors hover:bg-[#006b2d] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUpdating}
              onClick={() => void finishRdv()}
              type="button"
            >
              {isUpdating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Terminer la consultation
            </button>
          )}
        </div>
      }
      icon={<CalendarClock className="size-5" />}
      maxWidth="max-w-[580px]"
      open
      subtitle={`Étape ${currentStep} sur ${maxStep}`}
      title="Session de consultation"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Step indicator */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-1">
          {steps.map((label, index) => {
            const step = (index + 1) as WizardStep;
            const isActive = step === currentStep;
            const isDone = step < currentStep;

            return (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" key={label}>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-['Inter'] text-[12px] font-semibold transition-colors",
                    isDone
                      ? "bg-[#008236] text-white"
                      : isActive
                        ? "bg-[#052ca0] text-white"
                        : "bg-[#e2e8f0] text-[#94a3b8]",
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : step}
                </span>
                <span
                  className={cn(
                    "hidden text-center font-['Inter'] text-[11px] leading-4 sm:block",
                    isActive ? "font-semibold text-[#052ca0]" : "text-[#94a3b8]",
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[#e2e8f0]">
          <div
            className="h-full rounded-full bg-[#052ca0] transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (maxStep - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[220px]">
        {/* Step 1 (full flow): select RDV */}
        {backendStep === 1 ? (
          <div className="space-y-3">
            <p className="font-['Inter'] text-[13px] text-[#64748b]">
              Sélectionnez le rendez-vous à démarrer.
            </p>
            {rdvs.filter((r) => r.statut !== "termine" && r.statut !== "annule").length === 0 ? (
              <div className="flex h-[120px] items-center justify-center rounded-[10px] border-[0.8px] border-dashed border-[#c2e0ef] bg-[#f9fafb]">
                <span className="font-['Inter'] text-[13px] text-[#64748b]">
                  Aucun rendez-vous actif disponible.
                </span>
              </div>
            ) : (
              rdvs
                .filter((r) => r.statut !== "termine" && r.statut !== "annule")
                .map((rdv) => (
                  <button
                    className={cn(
                      "w-full rounded-[10px] border-[0.8px] bg-white p-4 text-left transition-colors",
                      selectedRdvId === rdv.id
                        ? "border-[#052ca0] bg-[#f0f6ff]"
                        : "border-[#c2e0ef] hover:bg-[#f8fbff]",
                    )}
                    key={rdv.id}
                    onClick={() => onSelectRdv(rdv.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-['Inter'] text-[14px] font-medium text-[#0f3460]">
                          {formatDate(rdv.date)} à {rdv.heure.slice(0, 5)}
                        </p>
                        <p className="mt-0.5 font-['Inter'] text-[12px] text-[#64748b]">
                          {rdv.type_creneau ?? "Consultation"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RdvStatusBadge status={rdv.statut} />
                        {selectedRdvId === rdv.id ? (
                          <Check className="size-4 text-[#052ca0]" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))
            )}
          </div>
        ) : null}

        {/* Step 2 (backend): link suivi */}
        {backendStep === 2 ? (
          <div className="space-y-4">
            {selectedRdv ? (
              <div className="rounded-[10px] border-[0.8px] border-[#76bbdd] bg-[#f0f6ff] px-4 py-3">
                <p className="font-['Inter'] text-[12px] font-semibold text-[#052ca0]">
                  Rendez-vous sélectionné
                </p>
                <p className="mt-0.5 font-['Inter'] text-[13px] text-[#0f3460]">
                  {formatDate(selectedRdv.date)} à {selectedRdv.heure.slice(0, 5)}
                  {" · "}{selectedRdv.type_creneau ?? "Consultation"}
                </p>
              </div>
            ) : null}

            <Field label="Suivi actif existant">
              <div className="relative">
                <select
                  className={cn(fieldControlClassName, "appearance-none pr-9")}
                  onChange={(e) => onSelectSuivi(e.target.value)}
                  value={selectedSuiviId}
                >
                  <option value="">Sélectionner un suivi</option>
                  {activeSuivis.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSuiviLabel(s)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              </div>
            </Field>

            <div className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-4">
              <p className="font-['Inter'] text-[13px] font-semibold text-[#0f3460]">
                Ou créer un nouveau suivi
              </p>
              <div className="mt-3 rounded-[10px] border-[1.4px] border-[#c2e0ef] bg-[#f8fafc] px-3 py-2.5">
                {symptoms.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {symptoms.map((sym) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-[#c2e0ef] bg-white px-2.5 py-0.5 font-['Inter'] text-[12px] text-[#0f3460]"
                        key={sym}
                      >
                        {sym}
                        <button
                          className="ml-0.5 cursor-pointer text-[#94a3b8] hover:text-[#e11d48]"
                          onClick={() => onRemoveSymptom(sym)}
                          type="button"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    className="h-9 min-w-0 flex-1 bg-transparent font-['Inter'] text-[13px] text-[#0f3460] outline-none placeholder:text-[#94a3b8]"
                    onChange={(e) => onSetSymptomDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddSymptom();
                      }
                    }}
                    placeholder="Ajouter un symptôme puis Entrée"
                    value={symptomDraft}
                  />
                  <button
                    className="flex h-9 cursor-pointer items-center gap-1 rounded-[8px] bg-[#eaf3fb] px-3 font-['Inter'] text-[12px] font-semibold text-[#0f3460] disabled:opacity-50"
                    disabled={!symptomDraft.trim()}
                    onClick={onAddSymptom}
                    type="button"
                  >
                    <Plus className="size-3" />
                    Ajouter
                  </button>
                </div>
              </div>
              <button
                className="mt-3 flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border-[1.4px] border-[#052ca0] px-3 font-['Inter'] text-[12px] font-semibold text-[#052ca0] transition-colors hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isUpdating || symptoms.length === 0}
                onClick={onCreateSuivi}
                type="button"
              >
                {isUpdating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Créer ce suivi
              </button>
            </div>
          </div>
        ) : null}

        {/* Step 3 (backend): create consultation */}
        {backendStep === 3 ? (
          <WorkflowStepAction
            description="Ouvrez le formulaire de consultation lié à ce rendez-vous et ce suivi. Le formulaire s'ouvre en superposition."
            icon={Stethoscope}
            label="Créer la consultation"
            onClick={openConsultation}
          />
        ) : null}

        {/* Step 4 (backend): import documents */}
        {backendStep === 4 ? (
          <WorkflowStepAction
            description="Importez les documents reçus pendant la visite si nécessaire. Cette étape est optionnelle."
            icon={FileUp}
            label="Importer des documents"
            onClick={openDocuments}
            optional
          />
        ) : null}

        {/* Step 5 (backend): finish */}
        {backendStep === 5 ? (
          <div className="rounded-[10px] border-[0.8px] border-[#bbf7d0] bg-[#f0fdf4] p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#008236] text-white">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="font-['Inter'] text-[15px] font-semibold text-[#166534]">
                  Prêt à terminer
                </p>
                <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#4b7a55]">
                  Le rendez-vous sera marqué comme terminé dans l'agenda. Cliquez sur "Terminer la consultation" pour valider.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DialogShell>
  );
}

function WorkflowStepAction({
  description,
  icon: Icon,
  label,
  onClick,
  optional = false,
}: {
  description: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  optional?: boolean;
}) {
  return (
    <div className="rounded-[10px] border-[0.8px] border-[#c2e0ef] bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eaf3fb] text-[#052ca0]">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-['Inter'] text-[15px] font-semibold text-[#0f3460]">
              {label}
            </p>
            {optional ? (
              <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 font-['Inter'] text-[11px] text-[#64748b]">
                Optionnel
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-['Inter'] text-[13px] leading-5 text-[#64748b]">
            {description}
          </p>
          <button
            className="mt-4 flex h-9 cursor-pointer items-center gap-2 rounded-[10px] bg-[#052ca0] px-4 font-['Inter'] text-[13px] font-semibold text-white shadow-[0px_3px_8px_rgba(5,44,160,0.3)] transition-colors hover:bg-[#082f9e]"
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RdvStatusBadge({ status }: { status: RendezVousStatut }) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 font-['Inter'] text-[11px] font-semibold",
        statusBadgeClass(status),
      )}
    >
      {option?.label ?? status}
    </span>
  );
}

function statusBadgeClass(status: RendezVousStatut) {
  switch (status) {
    case "termine":
      return "border-[#bbf7d0] bg-[#f0fdf4] text-[#008236]";
    case "confirme":
      return "border-[#c2e0ef] bg-[#eaf3fb] text-[#265284]";
    case "annule":
    case "non_present":
      return "border-[#fecaca] bg-[#fff1f2] text-[#e11d48]";
    case "bloque":
      return "border-[#d1d5db] bg-[#f3f4f6] text-[#4b5563]";
    default:
      return "border-[#fed7aa] bg-[#fff7ed] text-[#f97316]";
  }
}

function formatSuiviLabel(suivi: { motif?: string | null; symptoms?: string[] | null }) {
  const symptoms = Array.isArray(suivi.symptoms) && suivi.symptoms.length > 0
    ? suivi.symptoms
    : (suivi.motif ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  return symptoms.length > 0 ? symptoms.join(", ") : "Symptômes non renseignés";
}

function normalizeSymptoms(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((v) => v.trim())
    .filter((v) => {
      if (!v || seen.has(v.toLowerCase())) return false;
      seen.add(v.toLowerCase());
      return true;
    });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "PT"
  );
}
